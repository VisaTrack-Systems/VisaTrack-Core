const pr = danger.github.pr;
const changedFiles = danger.git.modified_files.concat(danger.git.created_files);
const totalChanges = pr.additions + pr.deletions;

// Warn if PR is too large
if (totalChanges > 2000) {
  warn("This PR is large. Consider breaking it into smaller PRs.");
}

// Warn if PR description is too short
if (!pr.body || pr.body.trim().length < 20) {
  warn("Please add a more detailed PR description.");
}

// Ensure README updates when core files change
if (
  changedFiles.some((f) => f.startsWith("backend/")) &&
  !changedFiles.some((f) => f.toLowerCase().includes("readme"))
) {
  warn("Backend changes detected without README updates.");
}

if (
  changedFiles.some((f) => f.startsWith("frontend/")) &&
  !changedFiles.some((f) => f.toLowerCase().includes("readme"))
) {
  warn("Frontend changes detected without README updates.");
}

// Warn if code changed without any test updates
const codeTouched = changedFiles.some(
  (f) =>
    f.startsWith("backend/") ||
    f.startsWith("frontend/") ||
    f.startsWith("scripts/"),
);
const testsTouched = changedFiles.some((f) =>
  f.toLowerCase().includes("test"),
);

if (codeTouched && !testsTouched) {
  warn("Code changes detected without test updates.");
}
