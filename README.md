# Language Courses

Two self-contained language courses in an old-style skill tree, served as a static site on GitHub Pages:

- **Kancil Indonesian** (`indonesian/`): 18 skills, 76 lessons, 478 words, 234 practice sentences
- **Zaga Burmese** (`burmese/`): 6 skills, 16 lessons, 80 words and letters

Progress syncs between devices through a private GitHub repo (`language-progress`). Each course keeps one JSON file there, and each save is a commit.

## One-time setup

1. **Turn on Pages:** this repo → Settings → Pages → Build and deployment → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save. The site appears at https://pwfarrell.github.io/language-courses/ after a minute or two.
2. **Make a sync token:** github.com → Settings → Developer settings → Personal access tokens → *Fine-grained tokens* → Generate new token.
   - Repository access: *Only select repositories* → `language-progress`
   - Repository permissions: *Contents* → *Read and write*
   - Generate, then copy the token (it starts with `github_pat_`).
3. **Connect each device:** open a course → *Words* tab → *Settings* → paste the token → *Connect*. One connection per device covers both courses.

The token lives only in that browser's storage and can only read and write the progress repo. When it expires, the course says so; generate a new one and reconnect.

## Editing the courses

Course content lives in plain text in `src/courses/<language>/course.txt`:

```
S|Section title|Native title
U|Skill title|Native title|icon|Tip shown in the guide
G|Guide paragraph, with *emphasis* for target-language words
X|Example sentence|English
L|Lesson title
w|word|english gloss|note|typing alternatives separated by /
s|Sentence.|English sentence.|alternative word orders|alternative English orders
```

Burmese sentences list their tiles explicitly: `s|တစ်=tit + ခွက်=khweq|One cup.|||extra=tile`.

After editing, rebuild and push:

```
python3 src/build.py
```

The engine (`src/engine/`) is shared by both courses; each course has its own `config.js` and `theme.css`.
