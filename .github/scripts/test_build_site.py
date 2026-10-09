"""Run after build_site.py --render; no third-party test dependencies."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import unittest
from urllib.parse import unquote, urljoin, urlsplit

from build_site import ROOT, paginate_log


class Links(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.urls = []
        self.ids = set()
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if "id" in values:
            self.ids.add(values["id"])
        for name in ("href", "src"):
            if values.get(name):
                self.urls.append(values[name])


class PaginationTests(unittest.TestCase):
    def test_all_authored_entries_appear_once_in_order(self):
        source = (ROOT / "captainslog.md").read_text()
        expected = re.findall(r"^### .+$", source, re.M)
        pages = paginate_log(source)
        actual = [entry for _, text in pages for entry in re.findall(r"^### .+$", text, re.M)]
        self.assertEqual(expected, actual)
        self.assertEqual(pages[0][0], "/captainslog/")
        self.assertTrue(all(len(re.findall(r"^### ", text, re.M)) <= 5 for _, text in pages))
        self.assertNotIn("log_previous:", pages[0][1])
        self.assertNotIn("log_next:", pages[-1][1])

    def test_empty_single_and_exact_boundary(self):
        base = "---\nlayout: article\npermalink: /captainslog/\n---\nIntro\n"
        for count in (0, 1, 5, 6, 10, 11):
            source = base + "".join(f"\n### Entry {n}\nBody {n}\n" for n in range(count))
            pages = paginate_log(source)
            self.assertEqual(len(pages), max(1, (count + 4) // 5))
            for index, (route, text) in enumerate(pages):
                self.assertIn("permalink: " + route, text)
                if index:
                    self.assertIn("log_previous: " + pages[index - 1][0], text)
                if index < len(pages) - 1:
                    self.assertIn("log_next: " + pages[index + 1][0], text)

    def test_code_fence_headings_are_not_entries(self):
        source = "---\npermalink: /captainslog/\n---\nIntro\n### First\n```md\n### Example\n```\n### Second\nBody\n"
        pages = paginate_log(source, page_size=1)
        self.assertEqual(len(pages), 2)
        self.assertIn("### Example", pages[0][1])


class RenderedSiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.site = ROOT / "_site"
        if not (cls.site / "index.html").exists():
            raise RuntimeError("Run python .github/scripts/build_site.py --render first")

    def test_original_public_routes_still_render(self):
        names = subprocess.check_output(["git", "ls-tree", "-r", "--name-only", "HEAD"], cwd=ROOT, text=True).splitlines()
        routes = ["/"]
        for name in names:
            if not name.endswith(".md") or name.startswith("."):
                continue
            text = subprocess.check_output(["git", "show", "HEAD:" + name], cwd=ROOT, text=True)
            routes.extend(re.findall(r"^permalink:\s*(/\S*)", text, re.M))
        for route in routes:
            with self.subTest(route=route):
                page = self.site / route.strip("/") / "index.html"
                self.assertTrue(page.is_file(), route)
                text = page.read_text()
                self.assertIn("<!doctype html>", text.lower())
                self.assertIn("<h1", text)

    def test_local_links_assets_and_fragments_resolve(self):
        broken = []
        for file in self.site.rglob("*.html"):
            route = "/" + file.relative_to(self.site).as_posix()
            parsed = Links(file.read_text())
            for href in parsed.urls:
                url = urlsplit(urljoin(route, href))
                if url.scheme or url.netloc:
                    continue
                target = self.site / unquote(url.path).lstrip("/")
                if target.is_dir():
                    target = target / "index.html"
                if not target.is_file():
                    broken.append((route, href))
                elif url.fragment and target.suffix == ".html":
                    if unquote(url.fragment) not in Links(target.read_text()).ids:
                        broken.append((route, href))
        self.assertEqual(broken, [])

    def test_all_log_entries_are_rendered_once(self):
        expected = re.findall(r"^### (.+)$", (ROOT / "captainslog.md").read_text(), re.M)
        pages = list((self.site / "captainslog").rglob("index.html"))
        headings = []
        for page in pages:
            headings.extend(re.findall(r"<h3[^>]*>(.*?)</h3>", page.read_text()))
        # Kramdown smartens apostrophes in the original entries.
        self.assertEqual(Counter(x.replace("'", "’") for x in expected), Counter(headings))

    def test_private_inputs_are_not_published(self):
        for name in ("tmp", ".github", ".codex", "dark-castle-site-plan.md"):
            self.assertFalse((self.site / name).exists())


if __name__ == "__main__":
    unittest.main()
