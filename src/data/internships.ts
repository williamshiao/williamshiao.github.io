export interface Internship {
  id: string;
  company: string;
  role: string;
  period: string;
  location: string;
  summary: string;
  highlights: string[];
  stack: string[];
}

// TODO(content): placeholder copy — replace with real write-ups once drafted.
export const internships: Internship[] = [
  {
    id: "frima-studio",
    company: "Frima Studio",
    role: "DevOps Intern",
    period: "TODO — dates",
    location: "Quebec City, QC",
    summary:
      "Placeholder summary: supported the studio's build and deployment pipelines for internal game projects, working on CI/CD reliability and developer tooling.",
    highlights: [
      "TODO: describe a concrete pipeline or infrastructure improvement shipped.",
      "TODO: describe a tool built to reduce friction for the dev team.",
      "TODO: describe a monitoring/incident-response contribution.",
    ],
    stack: ["TODO", "TODO", "TODO"],
  },
  {
    id: "equisoft",
    company: "Equisoft",
    role: "QA Intern",
    period: "TODO — dates",
    location: "Quebec City, QC",
    summary:
      "Placeholder summary: tested financial software products, wrote and maintained automated test coverage, and worked with dev teams to triage and reproduce defects.",
    highlights: [
      "TODO: describe a test suite or automation framework contributed to.",
      "TODO: describe a bug class caught before release and its impact.",
      "TODO: describe collaboration with developers/PMs on quality process.",
    ],
    stack: ["TODO", "TODO", "TODO"],
  },
];
