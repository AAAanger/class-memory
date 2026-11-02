"""生成 App 图标（192 / 512 / apple-touch-icon）。

改完颜色重跑一次：
    python scripts/gen-icons.py
"""

from PIL import Image, ImageDraw

BLUE = (37, 99, 235, 255)
WHITE = (255, 255, 255, 255)


def make(size: int) -> Image.Image:
    s = size
    img = Image.new("RGBA", (s, s), BLUE)
    d = ImageDraw.Draw(img)

    # 一块“黑板”
    left, top, right, bottom = s * 0.20, s * 0.25, s * 0.80, s * 0.75
    d.rounded_rectangle((left, top, right, bottom), radius=int(s * 0.055), fill=WHITE)

    # 板上的三行“板书”
    line_h = max(2, int(s * 0.032))
    x0 = left + s * 0.085
    x1 = right - s * 0.085
    rows = [
        (top + s * 0.115, 1.00),
        (top + s * 0.235, 0.68),
        (top + s * 0.355, 0.85),
    ]
    for y, factor in rows:
        d.rounded_rectangle(
            (x0, y, x0 + (x1 - x0) * factor, y + line_h),
            radius=line_h // 2,
            fill=BLUE,
        )

    return img


if __name__ == "__main__":
    import pathlib

    out = pathlib.Path(__file__).resolve().parent.parent / "public"
    out.mkdir(parents=True, exist_ok=True)

    make(192).save(out / "icon-192.png")
    make(512).save(out / "icon-512.png")
    make(180).convert("RGB").save(out / "apple-touch-icon.png")
    print("icons written to", out)
