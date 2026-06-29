package transport

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

// ErrConsoleHung is returned when the device reports an unresponsive console
// (most often RouterOS' "Console does not respond. Restart console?" prompt)
// or when a command times out and Ctrl-C fails to recover the session. The
// WS layer treats it as fatal and closes the underlying connection.
var ErrConsoleHung = errors.New("device console hung; session must be reopened")

// defaultCmdTimeout is the per-command read budget. Most CLI commands return
// within a second; 8s leaves room for slower commands like "display version"
// on a busy OLT while still failing fast on a dead session.
const defaultCmdTimeout = 8 * time.Second

// ansiRE strips CSI escape sequences (colour, line clears, cursor moves).
// Covers ESC[…<letter>, ESC]…BEL, and lone ESC[K that some MikroTik builds
// emit while echoing.
var ansiRE = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07`)

// stripANSI removes ANSI escapes and bare carriage returns so prompt
// detection works on the visible characters only.
func stripANSI(s string) string {
	s = ansiRE.ReplaceAllString(s, "")
	s = strings.ReplaceAll(s, "\r", "")
	return s
}

// SSHConn implements Conn over a persistent SSH "shell" session, which is
// what Huawei OLT/HG CLIs expect (they refuse Exec mode).
type SSHConn struct {
	client     *ssh.Client
	sess       *ssh.Session
	stdin      io.WriteCloser
	stdout     io.Reader
	prompts    []string
	promptRE   *regexp.Regexp
	cmdTimeout time.Duration
	onCommit   []byte
	failed     bool // set on fatal Send error so Close skips OnCommit
}

// SSHOptions tunes transport behaviour per device family. All fields are
// optional; zero values preserve the legacy DialSSH behaviour.
type SSHOptions struct {
	Prelude        []string
	Legacy         bool
	UsernameSuffix string         // appended to the login username (e.g. "+ctw500w")
	PromptRegex    *regexp.Regexp // anchored regex matched against the buffer tail
	OnConnect      []byte         // raw bytes sent after the initial prompt
	OnCommit       []byte         // raw bytes sent on graceful Close
}

// DialSSH opens a password-authed SSH connection and starts an interactive
// shell. After the initial prompt is detected the prelude commands are run
// silently to disable paging / colour / line wrap.
func DialSSH(host string, port int, username, password string, prompts []string, legacy bool) (*SSHConn, error) {
	return DialSSHWithOptions(host, port, username, password, prompts, SSHOptions{Legacy: legacy})
}

// DialSSHWithPrelude is DialSSH plus a silent post-login prelude.
func DialSSHWithPrelude(host string, port int, username, password string, prompts []string, prelude []string, legacy bool) (*SSHConn, error) {
	return DialSSHWithOptions(host, port, username, password, prompts, SSHOptions{Prelude: prelude, Legacy: legacy})
}

// DialSSHWithOptions is the canonical entry point. It honours UsernameSuffix
// (MikroTik's "+ctw500w"), PromptRegex (anchored tail match), and the
// OnConnect / OnCommit byte streams used to drive RouterOS Safe Mode.
func DialSSHWithOptions(host string, port int, username, password string, prompts []string, opts SSHOptions) (*SSHConn, error) {
	loginUser := username + opts.UsernameSuffix

	cfg := &ssh.ClientConfig{
		User:            loginUser,
		Auth:            []ssh.AuthMethod{ssh.Password(password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}
	if opts.Legacy {
		cfg.Config = ssh.Config{
			KeyExchanges: []string{
				"diffie-hellman-group1-sha1",
				"diffie-hellman-group14-sha1",
				"diffie-hellman-group-exchange-sha1",
				"diffie-hellman-group-exchange-sha256",
			},
			Ciphers: []string{"aes128-ctr", "aes256-ctr", "aes128-cbc", "3des-cbc"},
		}
	}
	addr := fmt.Sprintf("%s:%d", host, port)
	client, err := ssh.Dial("tcp", addr, cfg)
	if err != nil {
		return nil, fmt.Errorf("ssh dial %s: %w", addr, err)
	}
	sess, err := client.NewSession()
	if err != nil {
		client.Close()
		return nil, err
	}
	// Aggressively disable line discipline features that produce echo / ANSI
	// garbage. Width is wide enough that even MikroTik's long add-lines stay
	// on a single physical row, which is what kept biting us.
	modes := ssh.TerminalModes{
		ssh.ECHO:          0,
		ssh.ECHOCTL:       0,
		ssh.ICANON:        0,
		ssh.ISIG:          0,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := sess.RequestPty("vt100", 100, 500, modes); err != nil {
		sess.Close()
		client.Close()
		return nil, err
	}
	stdin, _ := sess.StdinPipe()
	stdout, _ := sess.StdoutPipe()
	if err := sess.Shell(); err != nil {
		sess.Close()
		client.Close()
		return nil, err
	}
	c := &SSHConn{
		client:     client,
		sess:       sess,
		stdin:      stdin,
		stdout:     stdout,
		prompts:    prompts,
		promptRE:   opts.PromptRegex,
		cmdTimeout: defaultCmdTimeout,
		onCommit:   opts.OnCommit,
	}
	// Wait for the initial prompt before issuing anything.
	_, _ = c.readUntilPrompt(5 * time.Second)
	// Fire the OnConnect bytes (RouterOS Safe Mode: 0x18). We send the bytes
	// directly — no \r — and re-read to the next prompt, which on success
	// will include the "<SAFE>" marker that PromptRegex tolerates.
	if len(opts.OnConnect) > 0 {
		_, _ = c.stdin.Write(opts.OnConnect)
		_, _ = c.readUntilPrompt(2 * time.Second)
	}
	// Run the silent prelude; ignore errors — these are best-effort tweaks.
	for _, cmd := range opts.Prelude {
		_, _ = c.Send(cmd)
	}
	return c, nil
}


// Send writes a command and reads until the device prompt or the per-command
// timeout. On timeout it sends Ctrl-C, drains the buffer, and returns an
// error so the caller stops the batch instead of cascading onto a dead
// session. If the device emits the RouterOS "console hung" dialog it answers
// "n" and returns ErrConsoleHung.
func (c *SSHConn) Send(cmd string) (string, error) {
	if _, err := io.WriteString(c.stdin, cmd+"\r"); err != nil {
		c.failed = true
		return "", err
	}
	out, err := c.readUntilPrompt(c.cmdTimeout)
	if err == nil {
		return out, nil
	}
	if errors.Is(err, ErrConsoleHung) {
		c.failed = true
		return out, err
	}
	// Timeout / unknown read state: try to clear the buffer with Ctrl-C so
	// the next command lands on a fresh prompt, otherwise surface the error.
	_, _ = io.WriteString(c.stdin, "\x03")
	drained, derr := c.readUntilPrompt(2 * time.Second)
	if derr != nil {
		c.failed = true
		return out + drained, fmt.Errorf("%w (recovery failed: %v)", ErrConsoleHung, derr)
	}
	return out + drained, fmt.Errorf("command timed out after %s", c.cmdTimeout)
}


// readUntilPrompt reads from stdout until any configured prompt appears at
// the tail of the visible (ANSI-stripped) buffer or until the deadline
// expires. Returns ErrConsoleHung if the device prints the RouterOS
// "Console does not respond" dialog and we cannot recover the prompt.
func (c *SSHConn) readUntilPrompt(timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout)
	buf := make([]byte, 4096)
	var raw bytes.Buffer
	for time.Now().Before(deadline) {
		// Best-effort short read. We rely on small sleeps between iterations
		// because golang.org/x/crypto/ssh exposes no per-read deadline.
		n, rerr := c.stdout.Read(buf)
		if n > 0 {
			raw.Write(buf[:n])
			visible := stripANSI(raw.String())
			// RouterOS may pop a confirmation prompt mid-stream — answer "n"
			// so the session does not die under us.
			if idx := strings.Index(visible, "Console does not respond"); idx >= 0 {
				_, _ = io.WriteString(c.stdin, "n\r")
				// Give the device a beat to recover, then try one more prompt
				// read on the remaining budget.
				time.Sleep(150 * time.Millisecond)
				if recovered, ok := awaitPromptTail(c, deadline); ok {
					return visible + recovered, nil
				}
				return visible, ErrConsoleHung
			}
			if tail, ok := c.matchPrompt(visible); ok {
				return tail, nil
			}

		}
		if rerr != nil {
			if rerr == io.EOF {
				return raw.String(), io.EOF
			}
			return raw.String(), rerr
		}
		time.Sleep(40 * time.Millisecond)
	}
	return raw.String(), fmt.Errorf("prompt not seen within %s", timeout)
}

// matchPromptTail returns the visible buffer when any prompt substring is
// present on (or very near) the last non-empty line. Anchoring to the tail
// stops us from declaring success when the prompt appears earlier inside an
// echoed command (e.g. an embedded "#").
func matchPromptTail(visible string, prompts []string) (string, bool) {
	if visible == "" {
		return "", false
	}
	// Inspect the last ~120 chars; that is plenty for any prompt string we
	// care about and keeps the scan cheap.
	tail := visible
	if len(tail) > 240 {
		tail = tail[len(tail)-240:]
	}
	for _, p := range prompts {
		if p == "" {
			continue
		}
		if strings.Contains(tail, p) {
			return visible, true
		}
	}
	return "", false
}

// awaitPromptTail keeps reading until the deadline looking for a prompt
// after we sent recovery input. Returns the freshly-read text and ok=true on
// success.
func awaitPromptTail(c *SSHConn, deadline time.Time) (string, bool) {
	buf := make([]byte, 4096)
	var extra bytes.Buffer
	for time.Now().Before(deadline) {
		n, err := c.stdout.Read(buf)
		if n > 0 {
			extra.Write(buf[:n])
			if _, ok := matchPromptTail(stripANSI(extra.String()), c.prompts); ok {
				return extra.String(), true
			}
		}
		if err != nil {
			return extra.String(), false
		}
		time.Sleep(40 * time.Millisecond)
	}
	return extra.String(), false
}

// Close shuts down the SSH session and underlying client.
func (c *SSHConn) Close() error {
	_ = c.sess.Close()
	return c.client.Close()
}
