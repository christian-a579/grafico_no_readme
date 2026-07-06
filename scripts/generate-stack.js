const fs = require("fs");

const username = process.env.GITHUB_USERNAME;
const token = process.env.GITHUB_TOKEN;

async function githubFetch(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    throw new Error(`Erro GitHub API: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function main() {
  const repos = await githubFetch(
    `https://api.github.com/users/${username}/repos?per_page=100&type=owner`
  );

  const totals = {};

  for (const repo of repos) {
    if (repo.fork) continue;

    const langs = await githubFetch(repo.languages_url);

    for (const [lang, bytes] of Object.entries(langs)) {
      totals[lang] = (totals[lang] || 0) + bytes;
    }
  }

  const totalBytes = Object.values(totals).reduce((a, b) => a + b, 0);

  const data = Object.entries(totals)
    .map(([lang, bytes]) => ({
      lang,
      percent: Math.round((bytes / totalBytes) * 100),
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 6);

  const rows = data
    .map((item, index) => {
      const y = 80 + index * 42;
      const width = item.percent * 4;

      return `
        <text x="30" y="${y}" fill="#fff" font-size="15">${item.lang}</text>
        <rect x="160" y="${y - 14}" width="400" height="18" rx="9" fill="#222"/>
        <rect x="160" y="${y - 14}" width="${width}" height="18" rx="9" fill="#00d26a"/>
        <text x="580" y="${y}" fill="#fff" font-size="15">${item.percent}%</text>
      `;
    })
    .join("");

  const svg = `
<svg width="680" height="360" viewBox="0 0 680 360" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="680" height="360" rx="20" fill="#000"/>
  <text x="30" y="40" fill="#fff" font-size="22" font-weight="bold">Stack dos meus projetos</text>
  <text x="30" y="65" fill="#aaa" font-size="14">Gerado automaticamente com base nos repositórios do GitHub</text>
  ${rows}
</svg>
`;

  fs.mkdirSync("assets", { recursive: true });
  fs.writeFileSync("assets/stack.svg", svg);
}

main();