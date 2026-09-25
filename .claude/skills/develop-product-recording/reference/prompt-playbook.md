# Prompt playbook: writing a prompt script before recording

Before the recording starts, offer to turn the user's idea into a short, professional prompt
script they can paste live into Claude Design and Claude Code. They still do the real prompting;
the script just makes each prompt clear and well-structured on camera.

Save it as `build-recording/prompt-script.md` and show it to the user before `REC start`.

## Shape of the script

4-9 prompts, in the order they will be used:

1. **Claude Design: the brief.** What it is, who it's for, the core experience, look and feel,
   page structure. The biggest prompt; it carries the vision.
2. **Claude Design: features.** One prompt per feature group (2-3 at most).
3. **Claude Design: polish.** Copy, typography, readability, the "made by a person" details.
4. **Export.** Not a prompt: a note to click Export → Claude Code, pausing on the button.
5. **Claude Code: build it.** Stack, structure, fidelity to the design, accessibility, performance,
   and a clear "Done when" line (build passes, checked in a browser).
6. **Claude Code: quality passes.** Realism, mobile, performance: one focused prompt each.
7. **Claude Code: ship it.** Repo, CI deploy, live URL.
8. **"Stop recording."**

## Rules for each prompt

- Open with one sentence stating the goal.
- Then short labelled groups (e.g. "Core experience", "Look and feel", "Requirements") with
  bullet points. Concrete nouns and numbers beat adjectives ("44px tap targets" > "easy to tap").
- End Claude Code prompts with **"Done when: …"** so the result is verifiable on camera.
- Short enough to read on screen: ideally under 20 lines. Split a long prompt into two.
- Plain English, no filler, no jargon the viewer wouldn't know unless it's the point.
- Keep the user's intent and wording where it's specific; tidy only the structure and spelling.
- Everything in the script must be something Claude can actually do in that tool.

## Recording tips to include

- Paste, then scroll slowly through the prompt so viewers can read it (or type the first line
  and paste the rest).
- Pause the cursor on important buttons for half a second before clicking.
- Full-screen windows on the main display; Do Not Disturb on.
