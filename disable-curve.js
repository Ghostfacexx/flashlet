
const fs = require("fs");
const path = require("path");

const filePath = path.resolve(__dirname, "MultiPairFlashArbitrage.js");
let content = fs.readFileSync(filePath, "utf8");

// Regex to comment out any line that tests a route involving 'curve'
const updatedContent = content
  .split("\n")
  .map(line => {
    if (line.includes("curve")) {
      return "// [DISABLED] " + line;
    }
    return line;
  })
  .join("\n");

fs.writeFileSync(filePath, updatedContent, "utf8");
console.log("✅ Curve-related routes disabled in MultiPairFlashArbitrage.js");
