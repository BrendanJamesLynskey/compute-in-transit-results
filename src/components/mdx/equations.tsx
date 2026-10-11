/**
 * The equations shown beside the widgets (visual standard §1: the maths next
 * to the picture). Server Components (KaTeX on the server). Each is the
 * formula the experiment or the simulation implements, as its source states
 * it (the experiment's results.md and README, Training_Transit_Sim's
 * analytic.py and hardware.py).
 */
import { Eq } from "./Eq";

/** Wire bytes per worker per step (results.md: ring collectives). */
export function WireEq(): JSX.Element {
  return (
    <Eq
      label="Bytes a worker sends per step: a ring all-reduce of B bytes sends 2 (N minus 1) over N times B; a ring all-gather of P bytes per worker sends N minus 1 times P, which grows with N."
      tex={String.raw`\text{all-reduce: } \tfrac{2(N-1)}{N}\,B \qquad \text{all-gather: } (N-1)\,P`}
    />
  );
}

/** Captured energy (results.md section 2). */
export function EnergyEq(): JSX.Element {
  return (
    <Eq
      label="The share of a tensor's energy a selector S keeps: the sum of the squared transform coefficients it keeps over the sum of all of them."
      tex={String.raw`\text{captured}(S) = \frac{\sum_{i \in S} c_i^2}{\sum_i c_i^2}, \qquad |S| = \text{keep} \times \text{chunk}`}
    />
  );
}

/** DeMo's error feedback, in the two designs. */
export function FeedbackEq(): JSX.Element {
  return (
    <Eq
      label="The delta is the momentum plus the residual; the next residual is the delta minus the exact band b in the first design, or minus the band actually sent, b hat, in the fix."
      tex={String.raw`\Delta_t = m_t + e_t, \qquad e_{t+1} = \Delta_t - \begin{cases} b_t & \text{exact band (first design)} \\ \hat b_t & \text{band sent (the fix)} \end{cases}`}
    />
  );
}

/** Readout noise per plane and after recombination (the experiment's README). */
export function NoiseEq(): JSX.Element {
  return (
    <Eq
      label="Each plane's readout noise has RMS FS times 2 to the minus ENOB times 2 over root 12; the planes are recombined with weights 2 to the b, which multiplies the noise by the square root of the sum of 4 to the b."
      tex={String.raw`\sigma_{\text{plane}} = \mathrm{FS}\cdot 2^{-\mathrm{ENOB}}\cdot\tfrac{2}{\sqrt{12}}, \qquad \sigma_{\text{value}} = \sigma_{\text{plane}}\sqrt{\textstyle\sum_{b=0}^{P-1} 4^{b}}`}
    />
  );
}

/** One step, and the time to a loss (analytic.py). */
export function StepEq(): JSX.Element {
  return (
    <Eq
      label="A step is the device's compute plus the sync: the sum over its rounds of latency plus bytes over bandwidth. Time to a loss is the measured steps times the step time."
      tex={String.raw`t_{\text{step}} = t_{\text{compute}} + \sum_{\text{rounds}} \Big(L + \frac{\text{bytes}}{\text{bandwidth}}\Big), \qquad T_{\text{loss}} = \text{steps}_{\text{measured}} \times t_{\text{step}}`}
    />
  );
}

/** A stream of b bytes through the module (hardware.py, analytic.module_stream). */
export function StreamEq(): JSX.Element {
  return (
    <Eq
      label="A stream of b bytes through the module takes its latency plus the slowest of four pipelined stages: the port, the optics with one pass per bit plane, the compute budget, and the FPGA."
      tex={String.raw`t = L_m + \max\!\Big(\frac{b}{\text{port}},\ \frac{(b/2)\,P}{\text{optics bit/s}},\ \frac{b\cdot\text{ops/byte}}{\text{budget}},\ \frac{\text{FPGA ops}}{\text{FPGA rate}}\Big)`}
    />
  );
}
