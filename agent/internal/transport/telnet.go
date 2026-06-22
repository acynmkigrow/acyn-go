package transport

import (
	"bytes"
	"fmt"
	"strings"
	"time"

	telnet "github.com/reiver/go-telnet"
)

// TelnetConn implements Conn over a raw RFC 854 Telnet session.
type TelnetConn struct {
	conn      *telnet.Conn
	prompts   []string
	readDelay time.Duration
}

// DialTelnet opens a Telnet session and waits for the device login prompt.
// The caller is expected to send username/password via Send.
func DialTelnet(host string, port int, username, password string, prompts []string) (*TelnetConn, error) {
	addr := fmt.Sprintf("%s:%d", host, port)
	conn, err := telnet.DialTo(addr)
	if err != nil {
		return nil, fmt.Errorf("telnet dial %s: %w", addr, err)
	}
	tc := &TelnetConn{conn: conn, prompts: prompts, readDelay: 400 * time.Millisecond}
	// Drain login banner & send credentials.
	_, _ = tc.readUntilAny([]string{"sername:", "ogin:"}, 3*time.Second)
	if _, err := tc.Send(username); err != nil {
		return nil, err
	}
	_, _ = tc.readUntilAny([]string{"assword:"}, 3*time.Second)
	if _, err := tc.Send(password); err != nil {
		return nil, err
	}
	_, _ = tc.readUntilAny(prompts, 5*time.Second)
	return tc, nil
}

// Send writes a command and reads until the device prompt or a sane timeout.
func (t *TelnetConn) Send(cmd string) (string, error) {
	if _, err := t.conn.Write([]byte(cmd + "\r\n")); err != nil {
		return "", err
	}
	time.Sleep(t.readDelay)
	return t.readUntilAny(t.prompts, 5*time.Second)
}

func (t *TelnetConn) readUntilAny(needles []string, timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout)
	buf := make([]byte, 4096)
	var out bytes.Buffer
	for time.Now().Before(deadline) {
		n, err := t.conn.Read(buf)
		if n > 0 {
			out.Write(buf[:n])
			s := out.String()
			for _, p := range needles {
				if strings.Contains(s, p) {
					return s, nil
				}
			}
		}
		if err != nil {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	return out.String(), nil
}

// Close terminates the Telnet session.
func (t *TelnetConn) Close() error { return t.conn.Close() }
