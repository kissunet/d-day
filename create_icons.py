import zlib
import struct
import math

def make_png(width, height, draw_func, filename):
    def chunk(two_type, data):
        return struct.pack('>I', len(data)) + two_type + data + struct.pack('>I', zlib.crc32(two_type + data) & 0xffffffff)

    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # filter type 0
        for x in range(width):
            r, g, b, a = draw_func(x, y, width, height)
            raw_data.extend([r, g, b, a])

    compressed = zlib.compress(raw_data, 9)
    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    idat = chunk(b'IDAT', compressed)
    iend = chunk(b'IEND', b'')

    with open(filename, 'wb') as f:
        f.write(header + ihdr + idat + iend)

def render_icon(x, y, w, h):
    # Center & normalization
    cx, cy = w / 2, h / 2
    dx = (x - cx) / (w / 2)
    dy = (y - cy) / (h / 2)
    dist = math.sqrt(dx*dx + dy*dy)

    # Gradient Background (#ec4899 -> #8b5cf6)
    t = (x + y) / (w + h)
    r = int(236 * (1 - t) + 139 * t)
    g = int(72 * (1 - t) + 92 * t)
    b = int(153 * (1 - t) + 246 * t)
    a = 255

    # Rounded Corner Container
    corner_r = 0.22
    if abs(dx) > (1 - corner_r) and abs(dy) > (1 - corner_r):
        cdx = abs(dx) - (1 - corner_r)
        cdy = abs(dy) - (1 - corner_r)
        if math.sqrt(cdx*cdx + cdy*cdy) > corner_r:
            a = 0

    # Draw Hourglass / D Icon in center
    nx = (x - cx) / w
    ny = (y - cy) / h
    
    # Hourglass shape
    if a > 0 and abs(nx) < 0.25 and abs(ny) < 0.25:
        # Top/bottom bars & triangle hourglass
        if abs(ny) > 0.2:
            r, g, b = 255, 255, 255
        elif abs(nx) < (0.2 - abs(ny) * 0.7):
            r, g, b = 255, 255, 255

    return r, g, b, a

print("Generating PWA Icons...")
make_png(192, 192, render_icon, "icon-192.png")
make_png(512, 512, render_icon, "icon-512.png")
print("Icons generated successfully!")
