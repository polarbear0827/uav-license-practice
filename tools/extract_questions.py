import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET


DOCX_PATH = Path(r"D:\Downloads\普通操作證學科測驗題庫_3833_090816_3833_112307.docx")
PDF_PATH = Path(r"D:\Downloads\普通操作證學科測驗題庫_3833_091026_3833_112424.pdf")
OUT_PATH = Path("web/questions.json")

CHAPTERS = [
    ("第一章", "民用航空法及相關法規"),
    ("第二章", "基礎飛行原理"),
    ("第三章", "氣象"),
    ("第四章", "緊急處置與飛行決策"),
]


def clean(value: str) -> str:
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def read_docx_paragraphs(path: Path) -> list[str]:
    with ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []
    for paragraph in root.findall(".//w:p", ns):
        text = "".join(node.text or "" for node in paragraph.findall(".//w:t", ns)).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def parse_docx(path: Path) -> list[dict]:
    paragraphs = read_docx_paragraphs(path)
    all_questions = []
    first_answer_start = paragraphs.index(f"{CHAPTERS[0][0]} {CHAPTERS[0][1]}答案")

    for chapter_idx, (prefix, title) in enumerate(CHAPTERS):
        chapter_heading = f"{prefix} {title}"
        answer_heading = f"{prefix} {title}答案"

        start = paragraphs.index(chapter_heading) + 1
        answer_start = paragraphs.index(answer_heading)
        end = (
            paragraphs.index(f"{CHAPTERS[chapter_idx + 1][0]} {CHAPTERS[chapter_idx + 1][1]}")
            if chapter_idx + 1 < len(CHAPTERS)
            else first_answer_start
        )

        question_lines = paragraphs[start:end]
        if len(question_lines) % 5 != 0:
            raise RuntimeError(f"{chapter_heading} question block is not divisible by 5")

        next_answer_start = (
            paragraphs.index(f"{CHAPTERS[chapter_idx + 1][0]} {CHAPTERS[chapter_idx + 1][1]}答案")
            if chapter_idx + 1 < len(CHAPTERS)
            else len(paragraphs)
        )
        answers = [line for line in paragraphs[answer_start + 1 : next_answer_start] if re.fullmatch(r"[ABCD]", line)]

        question_count = len(question_lines) // 5
        if len(answers) != question_count:
            raise RuntimeError(f"{chapter_heading} has {question_count} questions but {len(answers)} answers")

        for idx in range(question_count):
            block = question_lines[idx * 5 : idx * 5 + 5]
            options = []
            for expected_key, option_text in zip("ABCD", block[1:]):
                match = re.fullmatch(r"\(([ABCD])\)\s*(.+)", option_text)
                if not match or match.group(1) != expected_key:
                    raise RuntimeError(f"{chapter_heading} #{idx + 1} malformed option: {option_text}")
                options.append({"key": expected_key, "text": clean(match.group(2))})

            number = idx + 1
            all_questions.append(
                {
                    "id": f"{prefix}-{number:03d}",
                    "chapter": prefix,
                    "chapterTitle": title,
                    "number": number,
                    "question": clean(block[0]),
                    "options": options,
                    "answer": answers[idx],
                }
            )

    return all_questions


def read_pdf_text(path: Path) -> str:
    sys.path.insert(0, str(Path(".codex_tmp/pydeps").resolve()))
    from pypdf import PdfReader

    return "\n".join((page.extract_text() or "") for page in PdfReader(str(path)).pages)


def chapter_bounds(text: str, answer_start: int):
    bounds = []
    for idx, (prefix, title) in enumerate(CHAPTERS):
        pattern = rf"{prefix}\s+{re.escape(title)}\s*(?!答案)"
        start = re.search(pattern, text).end()
        if idx + 1 < len(CHAPTERS):
            next_prefix, next_title = CHAPTERS[idx + 1]
            next_match = re.search(rf"{next_prefix}\s+{re.escape(next_title)}\s*(?!答案)", text[start:])
            end = start + next_match.start()
        else:
            end = answer_start
        bounds.append((prefix, title, start, end))
    return bounds


def parse_pdf_answers(text: str):
    answers = {}
    for prefix, title in CHAPTERS:
        start_match = re.search(rf"{prefix}\s+{re.escape(title)}答案", text)
        if not start_match:
            raise RuntimeError(f"Missing answer section: {prefix} {title}")
        start = start_match.end()
        next_match = re.search(r"第[一二三四]章[^ \n]+.*?答案", text[start:])
        end = start + next_match.start() if next_match else len(text)
        section = text[start:end]
        answers[prefix] = {int(num): ans for num, ans in re.findall(r"(\d+)\.\s*([ABCD])", section)}
    return answers


def parse_pdf_questions(section: str, prefix: str, title: str, answers: dict[int, str]):
    matches = list(re.finditer(r"(?m)^\s*(\d+)\.\s+", section))
    questions = []
    for idx, match in enumerate(matches):
        number = int(match.group(1))
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(section)
        block = section[start:end]
        option_matches = list(re.finditer(r"\(([ABCD])\)\s*", block))
        if len(option_matches) != 4:
            raise RuntimeError(f"{prefix} {number} option count: {len(option_matches)}")

        question_text = clean(block[: option_matches[0].start()])
        options = []
        for opt_idx, opt_match in enumerate(option_matches):
            opt_start = opt_match.end()
            opt_end = option_matches[opt_idx + 1].start() if opt_idx + 1 < 4 else len(block)
            options.append({"key": opt_match.group(1), "text": clean(block[opt_start:opt_end])})

        questions.append(
            {
                "id": f"{prefix}-{number:03d}",
                "chapter": prefix,
                "chapterTitle": title,
                "number": number,
                "question": question_text,
                "options": options,
                "answer": answers[number],
            }
        )
    return questions


def parse_pdf(path: Path) -> list[dict]:
    text = read_pdf_text(path)
    answer_start = re.search(r"第一章\s+民用航空法及相關法規答案", text).start()
    answers_by_chapter = parse_pdf_answers(text)
    all_questions = []
    for prefix, title, start, end in chapter_bounds(text, answer_start):
        all_questions.extend(parse_pdf_questions(text[start:end], prefix, title, answers_by_chapter[prefix]))
    return all_questions


def build_payload(questions: list[dict], source_path: Path):
    return {
        "source": {
            "title": "遙控無人機普通操作證學科測驗題庫",
            "file": str(source_path),
            "updated": "115/2/2",
            "officialPage": "https://www.caa.gov.tw/Article.aspx?a=3833",
        },
        "exam": {
            "name": "普通操作證學科測驗",
            "questionCount": 20,
            "durationMinutes": 30,
            "passingScore": 80,
        },
        "chapters": [
            {
                "id": prefix,
                "title": title,
                "count": sum(1 for question in questions if question["chapter"] == prefix),
            }
            for prefix, title in CHAPTERS
        ],
        "questions": questions,
    }


def main():
    if DOCX_PATH.exists():
        source_path = DOCX_PATH
        questions = parse_docx(DOCX_PATH)
    elif PDF_PATH.exists():
        source_path = PDF_PATH
        questions = parse_pdf(PDF_PATH)
    else:
        raise FileNotFoundError("No DOCX or PDF question bank found in D:\\Downloads")

    payload = build_payload(questions, source_path)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(questions)} questions from {source_path.name} to {OUT_PATH}")


if __name__ == "__main__":
    main()
