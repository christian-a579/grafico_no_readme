const fs = require("fs");

const username = process.env.GITHUB_USERNAME;
const token = process.env.GITHUB_TOKEN;

async function githubFetch(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function fileExists(owner, repo, path) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  return res.ok;
}

async function getFileContent(owner, repo, path) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) return "";

  const data = await res.json();

  if (!data.content) return "";

  return Buffer.from(data.content, "base64").toString("utf-8");
}

function addScore(scores, name, points) {
  scores[name] = (scores[name] || 0) + points;
}

async function main() {
  const repos = await githubFetch(
    `https://api.github.com/users/${username}/repos?per_page=100&type=owner&sort=updated`
  );

  const scores = {};
  let projectCount = 0;
  let springProjects = 0;
  let apiProjects = 0;

  for (const repo of repos) {
    if (repo.fork) continue;

    projectCount++;

    const languages = await githubFetch(repo.languages_url);

    for (const [language, bytes] of Object.entries(languages)) {
      if (language === "Java") addScore(scores, "Java", bytes);
      if (language === "TypeScript") addScore(scores, "TypeScript", bytes);
      if (language === "JavaScript") addScore(scores, "JavaScript", bytes);
      if (language === "HTML") addScore(scores, "HTML/CSS", bytes);
      if (language === "CSS") addScore(scores, "HTML/CSS", bytes);
    }

    const pom = await getFileContent(username, repo.name, "pom.xml");
    const gradle = await getFileContent(username, repo.name, "build.gradle");
    const packageJson = await getFileContent(username, repo.name, "package.json");
    const dockerfile = await fileExists(username, repo.name, "Dockerfile");

    const javaConfig = `${pom} ${gradle}`.toLowerCase();
    const nodeConfig = packageJson.toLowerCase();

    if (javaConfig.includes("spring-boot")) {
      addScore(scores, "Spring Boot", 50000);
      springProjects++;
      apiProjects++;
    }

    if (nodeConfig.includes("@angular/core")) {
      addScore(scores, "Angular", 50000);
    }

    if (nodeConfig.includes("express")) {
      addScore(scores, "Node.js / Express", 50000);
      apiProjects++;
    }

    if (
      javaConfig.includes("mysql") ||
      nodeConfig.includes("mysql") ||
      nodeConfig.includes("sequelize") ||
      nodeConfig.includes("typeorm")
    ) {
      addScore(scores, "MySQL", 25000);
    }

    if (dockerfile) {
      addScore(scores, "Docker", 25000);
    }
  }

  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);

  const data = Object.entries(scores)
    .map(([name, score]) => ({
      name,
      percent: Math.round((score / total) * 100),
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 7);

  const rows = data
    .map((item, index) => {
      const y = 112 + index * 34;
      const width = Math.max(item.percent * 3.8, 8);

      return `
        <text x="32" y="${y}" fill="#ffffff" font-size="14" font-family="Arial, sans-serif">${item.name}</text>
        <rect x="180" y="${y - 13}" width="380" height="15" rx="7.5" fill="#1f2937"/>
        <rect x="180" y="${y - 13}" width="${width}" height="15" rx="7.5" fill="#22c55e"/>
        <text x="580" y="${y}" fill="#ffffff" font-size="14" font-family="Arial, sans-serif">${item.percent}%</text>
      `;
    })
    .join("");

  const svg = `
<svg width="700" height="430" viewBox="0 0 700 430" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="700" height="430" rx="20" fill="#0d1117"/>

  <text x="32" y="44" fill="#ffffff" font-size="24" font-weight="700" font-family="Arial, sans-serif">
    📊 Tech Stack
  </text>

  <text x="32" y="72" fill="#9ca3af" font-size="14" font-family="Arial, sans-serif">
    Gerado automaticamente com base nos meus repositórios do GitHub
  </text>

  ${rows}

  <rect x="32" y="365" width="636" height="1" fill="#30363d"/>

  <text x="32" y="395" fill="#9ca3af" font-size="13" font-family="Arial, sans-serif">
    ✔ ${projectCount} repositórios analisados
  </text>

  <text x="245" y="395" fill="#9ca3af" font-size="13" font-family="Arial, sans-serif">
    ✔ ${springProjects} projetos Spring Boot
  </text>

  <text x="480" y="395" fill="#9ca3af" font-size="13" font-family="Arial, sans-serif">
    ✔ ${apiProjects} APIs detectadas
  </text>
</svg>
`;

  fs.mkdirSync("assets", { recursive: true });
  fs.writeFileSync("assets/tech-stack.svg", svg);
}

main();