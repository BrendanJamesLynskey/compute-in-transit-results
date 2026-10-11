/** The shapes of the vendored and derived JSON files. */

export type RunConfig = {
  variant: "adamw" | "topk" | "band" | "calib" | "optics";
  band: string;
  keep: number;
  chunk_mode: "1d" | "2d";
  chunk: number;
  enob: number | null;
  planes: number | null;
  fs_every: number | null;
  feedback: "exact" | "sent" | null;
  lr: number;
  seed: number;
};

export type Run = {
  name: string;
  group: string;
  label: string;
  config: RunConfig;
  device: string;
  seconds: number;
  evals: {
    step: number[];
    val_loss: number[];
    train_loss: number[];
    payload_bytes: number[];
    wire_bytes: number[];
    seconds: number[];
    clip_rate: (number | null)[];
    clip_rate_interval: (number | null)[];
  };
  diags: { step: number[]; energy: Record<string, (number | null)[]> };
};

export type RunsFile = {
  source: string;
  commit: string;
  path: string;
  runs: Run[];
};

export type ResultRow = {
  group: string;
  label: string;
  variant: string;
  seeds: number;
  final_val: number;
  final_val_sd: number;
  payload_per_step: number;
  payload_int64_per_step: number;
  wire_per_step: number;
  ratio_vs_dense: number;
  wire_ratio_vs_dense: number;
  steps_to_target: number | null;
  reached: string;
  seconds: number;
  clip_rate?: number;
  clip_rate_last?: number;
};

export type ExperimentResults = {
  target: number;
  rows: ResultRow[];
  energy: Record<string, Record<string, number>>;
};

export type SimResults = Record<string, unknown> & {
  time_to_target: Record<
    string,
    Record<
      string,
      {
        steps: number | null;
        step_ms: number;
        seconds: number | null;
        hot_spot: string;
      }
    >
  >;
  energy: Record<
    string,
    {
      compute: number;
      link: number;
      module: number;
      to_target_j: number | null;
    }
  >;
  /** Section 9: the engine's mean step (s) under background WAN load (discrete-event only). */
  background: Record<
    string,
    { analytic: number; loads: number[]; step: number[]; wan_busy_09: number }
  >;
  /** Section 10: time to the target (s) at each model size, and syncing every H steps. */
  extrapolate_size: Record<string, number[]>;
  extrapolate_h: Record<string, number[]>;
};

export type VendoredFile = {
  file: string;
  source: string;
  commit: string;
  path: string;
  sha256: string;
  generated_by?: string;
};
export type Vendored = { vendored: VendoredFile[]; derived: VendoredFile[] };
