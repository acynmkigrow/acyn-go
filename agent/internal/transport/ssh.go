package transport

import (
	"bytes"
	"fmt"
	"io"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

// SSHConn implements Conn over a persistent SSH "shell" session, which is
// what Huawei OLT/HG CLIs expect (they refuse Exec mode).
type SSHConn struct {
	client  *ssh.Client
	sess    *ssh.Session
	stdin   io.WriteCloser
	stdout  io.Reader
	prompts []string
}

// DialSSH opens a password-authed SSH connection and starts an interactive shell.
func DialSSH(host string, port int, username, password string, prompts []string, legacy bool) (*SSHConn, error) {
	cfg := &ssh.ClientConfig{
		User: username,
		Auth: []ssh.AuthMethod{ssh.Password(password)},
		// Huawei devices use self-signed host keys; accept any.
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}
	if legacy {
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
	modes := ssh.TerminalModes{
		ssh.ECHO:          0,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := sess.RequestPty("vt100", 80, 200, modes); err != nil {
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
	c := &SSHConn{client: client, sess: sess, stdin: stdin, stdout: stdout, prompts: prompts}
	// Wait for the initial prompt.
	_, _ = c.readUntilAny(prompts, 5*time.Second)
	return c, nil
}

// Send writes a command and reads until the device prompt or a sane timeout.
func (c *SSHConn) Send(cmd string) (string, error) {
	if _, err := io.WriteString(c.stdin, cmd+"\n"); err != nil {
		return "", err
	}
	time.Sleep(300 * time.Millisecond)
	return c.readUntilAny(c.prompts, 5*time.Second)
}

func (c *SSHConn) readUntilAny(needles []string, timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout)
	buf := make([]byte, 4096)
	var out bytes.Buffer
	for time.Now().Before(deadline) {
		n, _ := c.stdout.Read(buf)
		if n > 0 {
			out.Write(buf[:n])
			s := out.String()
			for _, p := range needles {
				if strings.Contains(s, p) {
					return s, nil
				}
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	return out.String(), nil
}

// Close shuts down the SSH session and underlying client.
func (c *SSHConn) Close() error {
	_ = c.sess.Close()
	return c.client.Close()
}
