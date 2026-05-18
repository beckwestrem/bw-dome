from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from newsletter.models import Digest


def render_html(digest: Digest) -> str:
    templates_path = Path(__file__).parent / "templates"
    env = Environment(
        loader=FileSystemLoader(templates_path),
        autoescape=select_autoescape(["html", "xml"]),
    )
    template = env.get_template("digest_email.html")
    return template.render(digest=digest)
