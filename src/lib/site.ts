/**
 * Site-wide constants: this site's URL, the Compute in Transit hub and its
 * five decks, the experiment's and the simulation's repositories, the
 * papers, and the Colab link.
 */

/** This site (production, once deployed). */
export const SITE_URL = "https://compute-in-transit-results.vercel.app";

export const GITHUB_URL =
  "https://github.com/BrendanJamesLynskey/compute-in-transit-results";

/** The series' hub (GitHub Pages). */
export const HUB_URL =
  "https://brendanjameslynskey.github.io/LLM_Hub_Compute_in_Transit/";

/** The five decks of the series, in order. */
export const DECKS = [
  {
    n: 1,
    repo: "CiT_01_Compute_in_Transit",
    title: "Compute in Transit: the Idea and the Budget",
  },
  {
    n: 2,
    repo: "CiT_02_Data_Movement_in_LLM_Training",
    title: "Data Movement in LLM Training",
  },
  {
    n: 3,
    repo: "CiT_03_Data_Movement_in_LLM_Inference",
    title: "Data Movement in LLM Inference",
  },
  {
    n: 4,
    repo: "CiT_04_Fixed_Band_Experiment",
    title: "The Fixed-Band Experiment",
  },
  {
    n: 5,
    repo: "CiT_05_Training_Transit_Simulation",
    title: "Training Transit, Simulated",
  },
] as const;

/** A deck, or one of its slides (anchors are #slide-NN). */
export function deck(repo: string, slide?: number): string {
  const base = `https://brendanjameslynskey.github.io/${repo}/`;
  return slide === undefined
    ? base
    : `${base}#slide-${String(slide).padStart(2, "0")}`;
}

export const EXPERIMENT_REPO =
  "https://github.com/BrendanJamesLynskey/DeMo_Fixed_Band_Experiment";
export const SIM_REPO =
  "https://github.com/BrendanJamesLynskey/Training_Transit_Sim";
export const DISAGG_REPO =
  "https://github.com/BrendanJamesLynskey/Disaggregated_Inference_Sim";

/** A file in a repository at a commit. */
export function fileAt(repo: string, commit: string, path: string): string {
  return `${repo}/blob/${commit}/${path}`;
}

/** The notebook in Colab (opens the experiment repository's main branch). */
export const COLAB_URL =
  "https://colab.research.google.com/github/BrendanJamesLynskey/DeMo_Fixed_Band_Experiment/blob/main/colab/run_sweep.ipynb";

/** DeMo (Peng et al.) and the photonic link module's paper (Kundu et al.), checked at export.arxiv.org. */
export const DEMO_PAPER = "https://arxiv.org/abs/2411.19870";
export const MODULE_PAPER = "https://arxiv.org/abs/2608.21536";

/** A file in this site's repository on GitHub. */
export function repoFile(path: string): string {
  return `${GITHUB_URL}/blob/main/${path}`;
}
