import "server-only";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import type { ArchivoArbol, CommitInfo, GitHubCliente, RepoInfo } from "@/lib/github";

/**
 * Cliente real de GitHub sobre Octokit, autenticado como la GitHub App instalada en la
 * organización (D-04). Los tokens de instalación caducan solos y Octokit los renueva.
 *
 * GITHUB_API_BASE permite apuntar a un servidor simulado en tests e2e (sin credenciales).
 */
let instancia: Octokit | null = null;

function octokit(): Octokit {
  if (instancia) return instancia;
  const baseUrl = process.env.GITHUB_API_BASE ?? "https://api.github.com";
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  if (appId && privateKey && installationId) {
    instancia = new Octokit({ baseUrl, authStrategy: createAppAuth, auth: { appId, privateKey, installationId: Number(installationId) } });
  } else if (process.env.GITHUB_API_BASE) {
    instancia = new Octokit({ baseUrl }); // simulado en tests
  } else {
    throw new Error("Faltan GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY o GITHUB_APP_INSTALLATION_ID (ver .env.example).");
  }
  return instancia;
}

const estado = (e: unknown) => (e as { status?: number }).status;

interface CommitApi {
  sha: string;
  author: { login?: string } | null;
  commit: { author: { name?: string; date?: string } | null; committer: { date?: string } | null };
}

function mapCommit(c: CommitApi): CommitInfo {
  return {
    sha: c.sha,
    // Fecha del autor: refleja cuándo se escribió el cambio (un rebase cambia la del committer).
    fecha: new Date(c.commit.author?.date ?? c.commit.committer?.date ?? 0),
    autor: c.author?.login ?? c.commit.author?.name ?? null,
  };
}

export const clienteGithub: GitHubCliente = {
  async repo(owner, name): Promise<RepoInfo | null> {
    try {
      const { data } = await octokit().rest.repos.get({ owner, repo: name });
      return {
        owner: data.owner.login,
        name: data.name,
        createdAt: new Date(data.created_at),
        defaultBranch: data.default_branch,
        privado: data.private,
      };
    } catch (e) {
      if (estado(e) === 404) return null;
      throw e;
    }
  },

  async commits(owner, name, { since, until, path, max }): Promise<CommitInfo[]> {
    const params = {
      owner,
      repo: name,
      since: since?.toISOString(),
      until: until?.toISOString(),
      path,
      per_page: max && max < 100 ? max : 100,
    };
    try {
      if (max && max <= 100) {
        const { data } = await octokit().rest.repos.listCommits(params);
        return data.slice(0, max).map(mapCommit);
      }
      // Paginado completo, con tope de seguridad de 2.000 commits por repositorio.
      const todos: CommitInfo[] = [];
      for await (const { data } of octokit().paginate.iterator(octokit().rest.repos.listCommits, params)) {
        todos.push(...data.map(mapCommit));
        if (todos.length >= 2000) break;
      }
      return todos;
    } catch (e) {
      // Repo vacío (409) o inexistente.
      if (estado(e) === 409 || estado(e) === 404) return [];
      throw e;
    }
  },

  async arbol(owner, name, ref): Promise<ArchivoArbol[]> {
    try {
      const { data } = await octokit().rest.git.getTree({ owner, repo: name, tree_sha: ref, recursive: "1" });
      return data.tree
        .filter((t) => t.path && t.sha && (t.type === "blob" || t.type === "tree"))
        .map((t) => ({ path: t.path!, tipo: t.type as "blob" | "tree", sha: t.sha!, size: t.size }));
    } catch (e) {
      if (estado(e) === 404 || estado(e) === 409) return [];
      throw e;
    }
  },

  async contenido(owner, name, blobSha): Promise<string> {
    const { data } = await octokit().rest.git.getBlob({ owner, repo: name, file_sha: blobSha });
    return data.encoding === "base64" ? Buffer.from(data.content, "base64").toString("utf8") : data.content;
  },

  async tag(owner, name, tag) {
    try {
      const { data: ref } = await octokit().rest.git.getRef({ owner, repo: name, ref: `tags/${tag}` });
      let sha = ref.object.sha;
      if (ref.object.type === "tag") {
        // Tag anotado: apunta a un objeto tag que a su vez apunta al commit.
        const { data: anotado } = await octokit().rest.git.getTag({ owner, repo: name, tag_sha: sha });
        sha = anotado.object.sha;
      }
      const { data: commit } = await octokit().rest.git.getCommit({ owner, repo: name, commit_sha: sha });
      return { sha, fecha: new Date(commit.committer.date) };
    } catch (e) {
      if (estado(e) === 404) return null;
      throw e;
    }
  },
};
