# CLAUDE.md
# Agent Context + Token Efficiency Rules

This repository powers a large-scale strategy game with a 3D planetary map, parcel system, AI factions, and blockchain interactions.

Efficient context usage is critical.

Claude must actively manage context and spawn subagents when performing large investigations.

---

# Core Principle

Context is the most valuable resource.

Every unnecessary file read wastes tokens.

Agents must minimize context usage and return summaries whenever possible.

---

# Default Agent Behavior

Claude should **spawn subagents automatically** when:

• Reading more than 3 files  
• Investigating architecture  
• Performing codebase exploration  
• Debugging systems  
• Reviewing code patterns  
• Running research tasks  
• Producing large analysis output  

Subagents should:

• read files in isolation  
• inspect architecture  
• summarize results  
• return concise conclusions  

---

# Stay in Main Context For

Claude should **NOT spawn subagents** when:

• Directly editing a file the user requested  
• Reading 1–2 files only  
• Performing quick clarifications  
• Writing implementation code the user must see  

---

# Decision Rule

If a task will:

• read more than 3 files  
• scan architecture  
• generate long analysis  

→ spawn a subagent and return a **summary only**

---

# Token Efficiency Rules

Claude must minimize token usage.

Always follow:

1. Prefer short explanations
2. Use bullet points instead of paragraphs
3. Avoid repeating code already shown
4. Avoid scanning the entire repo
5. Only read necessary files
6. Return summaries when possible
7. Avoid verbose reasoning unless asked
8. Prefer full file replacements over large diffs
9. Do not output unnecessary narrative text
10. Ask before performing large repo analysis

---

# Communication Style

Claude responses should be:

• concise  
• structured  
• direct  
• minimal filler  

Prefer:

✔ bullet lists  
✔ short summaries  
✔ code blocks  

Avoid:

✖ long essays  
✖ repeated explanations  
✖ verbose reasoning  

---

# Code Generation Rules

When modifying files:

• Prefer complete file outputs  
• Avoid fragmented patches  
• Ensure code compiles  
• Maintain modular architecture  
• Do not refactor unrelated systems  

---

# Investigation Workflow

When investigating a system:

1. Spawn subagent
2. Let agent explore files
3. Return concise summary including:

• relevant files  
• architecture overview  
• issues found  
• recommended fix  

---

# Rule of Thumb

If a task requires:

• reading many files
• understanding architecture
• investigating behavior

→ spawn subagent

If the user must see implementation steps

→ stay in main context

---

# Expected Outcome

This system should:

• reduce token usage
• prevent unnecessary file scanning
• improve code clarity
• allow efficient architecture exploration

---

# Session Notes

> Session logs are stored in [`session-notes/`](session-notes/). See [session-notes/README.md](session-notes/README.md) for the full index.
>
> Claude must create a new dated file in `session-notes/` at the end of each session instead of appending here.
