# Carousel & Video Project

This folder produces carousels (static slide series) and short videos.
Use the `lemo-opuscar` skill for every video and for carousel frames.

## Workflow

1. **Brief.** Ask for these, if missing:
   - Topic and key message
   - Audience
   - Format: carousel (number of slides) or video (length in seconds)
   - Tone: direct, playful, premium, technical, etc.
   - Own material: voice, music, logo, brand colours, footage
2. **Suggest styles.** Propose 2–3 styles from the table below. For each, give one line on why it fits. Do not run anything until the user picks one.
3. **Produce.** Run `lemo-opuscar:lemo-opuscar` with the chosen style.
4. **Deliver.** Save each project in its own subfolder: `carousel-and-video-project/<name>/`. Tell the user where the files are.

## Style picker

Choose from these starting points. Use the full index in the library's `styles/README.md` for others.

| Need | Candidate styles |
|---|---|
| Explain a concept step by step | Whiteboard Explainer, One-line Drawing, Chalkboard |
| Data or process breakdown | Isometric Infographic, Data Storytelling, Transit Map |
| Product launch or feature tour | Living Screencast, Dark Tech Keynote, Exploded Teardown |
| Bold typography slides | Swiss Motion Graphics, Art Deco, Blueprint |
| Editorial or case-file look | Halftone Dossier, Caption News, Visual Investigation |
| Warm storytelling | Watercolor Brush, Crayon Picture Book, Impasto Oil Painting |
| Retro or playful | Risograph Print, Mid-century Cartoon, 80s Cel Anime |
| Evidence and real material | Satellite Briefing, LiDAR Survey, Archive Light Table |

## Format notes

- **Carousels:** the library renders stills with `core/render/still.mjs`. Check the slide size and aspect ratio before the first full run. Keep one message per slide.
- **Videos:** default to 30–60 seconds unless the user specifies otherwise.

## Rules

- Never pick a style silently. Always offer options and wait for the user's choice.
- Name each output file with the project name and the date.
- Ask before any commit or push.
