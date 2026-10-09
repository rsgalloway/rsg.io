"""Stage public source, paginate the log, then generate Jekyll input with mkpages."""
from pathlib import Path
import argparse
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
PAGE_SIZE = 5
PUBLIC_DIRS = ("blog", "projects", "castle", "assets", "_layouts", "_includes", "_data")


def paginate_log(source, page_size=PAGE_SIZE):
    """Return (route, Markdown) pairs; retain one Markdown authoring source."""
    if page_size < 1:
        raise ValueError("page_size must be positive")
    match = re.match(r"\A---\n(.*?)\n---\n(.*)\Z", source, re.S)
    if not match:
        raise ValueError("Captain's Log requires YAML front matter")
    front, body = match.groups()
    parts = [""]
    fence = None
    for line in body.splitlines(keepends=True):
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line.rstrip("\n"))
        if marker:
            run, rest = marker.groups()
            if fence is None:
                fence = run
            elif run[0] == fence[0] and len(run) >= len(fence) and not rest.strip():
                fence = None
        if fence is None and line.startswith("### "):
            parts.append("")
        parts[-1] += line
    intro, entries = parts[0], parts[1:]
    count = max(1, (len(entries) + page_size - 1) // page_size)
    pages = []
    for number in range(1, count + 1):
        route = "/captainslog/" if number == 1 else f"/captainslog/page/{number}/"
        page_front = re.sub(r"^permalink:.*$", "permalink: " + route, front, flags=re.M)
        page_front += f"\nlog_page: {number}\nlog_pages: {count}"
        if number > 1:
            page_front += "\nlog_previous: " + ("/captainslog/" if number == 2 else f"/captainslog/page/{number-1}/")
        if number < count:
            page_front += f"\nlog_next: /captainslog/page/{number+1}/"
        text = "---\n" + page_front + "\n---\n" + intro
        text += "".join(entries[(number-1)*page_size:number*page_size])
        pages.append((route, text))
    return pages


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--render", action="store_true", help="Also render HTML with local Jekyll")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="rsg-castle-") as directory:
        staging = Path(directory)
        for source in ROOT.glob("*.md"):
            shutil.copy2(source, staging / source.name)
        for name in ("mkpages.yml", "theme.css"):
            shutil.copy2(ROOT / name, staging / name)
        for name in PUBLIC_DIRS:
            if (ROOT / name).exists():
                shutil.copytree(ROOT / name, staging / name)
        pages = paginate_log((ROOT / "captainslog.md").read_text())
        for number, (_, text) in enumerate(pages, 1):
            target = staging / ("captainslog.md" if number == 1 else f"captainslog/page/{number}/index.md")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text)
        subprocess.run(["mkpages", "build", str(staging), "--output", str(ROOT / ".mkpages")], check=True)
        print(f"Captain's Log: {len(pages)} static pages ({PAGE_SIZE} entries per page).")

    if args.render:
        subprocess.run(["jekyll", "build", "--destination", str(ROOT / "_site")], cwd=ROOT / ".mkpages", check=True)


if __name__ == "__main__":
    main()
