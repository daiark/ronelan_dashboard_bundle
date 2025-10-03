import glob
from fastapi import APIRouter

router = APIRouter()


def list_ports():
    candidates = []
    for pattern in ("/dev/ttyAMA*", "/dev/ttyUSB*", "/dev/serial*", "/dev/ttyS*"):
        candidates.extend(glob.glob(pattern))
    # Deduplicate and sort
    return sorted(set(candidates))


@router.get("/ports")
async def get_ports():
    # Return plain array to match frontend expectations
    return list_ports()

