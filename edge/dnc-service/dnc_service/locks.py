import os
import errno
from contextlib import contextmanager


BASE = "/tmp"


def _lock_path(port: str) -> str:
    safe = port.replace("/", "_")
    return os.path.join(BASE, f"cnc-dnc.{safe}.lock")


@contextmanager
def port_lock(port: str):
    path = _lock_path(port)
    fd = None
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
        os.write(fd, b"locked")
        yield
    except OSError as e:
        if e.errno == errno.EEXIST:
            raise RuntimeError(f"Port {port} is busy")
        raise
    finally:
        if fd is not None:
            os.close(fd)
        try:
            os.unlink(path)
        except FileNotFoundError:
            pass

