#!/usr/bin/env python3
"""
Generate Windows-compliant ICO file from PNG.
Ensures standard sizes (16, 24, 32, 48, 64, 128) are raw 32-bit BMP (DIB)
and 256x256 is PNG compressed, adhering strictly to Windows PE/GDI & NSIS specifications.
"""
import io
import struct
from pathlib import Path
from PIL import Image

def make_ico(png_path: Path, out_ico_path: Path):
    base_img = Image.open(png_path).convert('RGBA')
    sizes = [16, 24, 32, 48, 64, 128, 256]
    
    entries = []
    images_data = []
    
    for s in sizes:
        resized = base_img.resize((s, s), Image.Resampling.LANCZOS)
        if s == 256:
            buf = io.BytesIO()
            resized.save(buf, format='PNG', optimize=True)
            data = buf.getvalue()
        else:
            w, h = s, s
            bih = struct.pack('<IIIHHIIIIII',
                40,             # biSize
                w,              # biWidth
                h * 2,          # biHeight (XOR + AND mask)
                1,              # biPlanes
                32,             # biBitCount
                0,              # biCompression (BI_RGB)
                w * h * 4,      # biSizeImage
                0, 0, 0, 0      # Pels, Clr
            )
            
            xor_rows = []
            and_rows = []
            and_row_bytes = ((w + 31) // 32) * 4
            
            for y in range(h - 1, -1, -1):
                row_bgra = bytearray()
                for x in range(w):
                    r, g, b, a = resized.getpixel((x, y))
                    row_bgra.extend([b, g, r, a])
                
                and_row = bytearray(and_row_bytes)
                for x in range(w):
                    _, _, _, a = resized.getpixel((x, y))
                    if a == 0:
                        and_row[x // 8] |= (1 << (7 - (x % 8)))
                
                xor_rows.append(bytes(row_bgra))
                and_rows.append(bytes(and_row))
                
            data = bih + b''.join(xor_rows) + b''.join(and_rows)
            
        images_data.append(data)
        w_byte = 0 if s == 256 else s
        h_byte = 0 if s == 256 else s
        entries.append({
            'w': w_byte,
            'h': h_byte,
            'size': len(data),
            'bpp': 32
        })
        
    header_size = 6 + len(sizes) * 16
    current_offset = header_size
    header = struct.pack('<HHH', 0, 1, len(sizes))
    dir_entries = bytearray()
    
    for entry in entries:
        dir_entries.extend(struct.pack('<BBBBHHII',
            entry['w'],
            entry['h'],
            0, # colors
            0, # reserved
            1, # planes
            entry['bpp'],
            entry['size'],
            current_offset
        ))
        current_offset += entry['size']
        
    with open(out_ico_path, 'wb') as f:
        f.write(header)
        f.write(dir_entries)
        for data in images_data:
            f.write(data)
    print(f'Successfully generated {out_ico_path} with {len(sizes)} icons.')

if __name__ == '__main__':
    root = Path(__file__).resolve().parent.parent
    png = root / 'assets' / 'branding' / 'icon.png'
    ico = root / 'assets' / 'branding' / 'icon.ico'
    make_ico(png, ico)
