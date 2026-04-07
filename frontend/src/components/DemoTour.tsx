import { useCallback, useEffect, useState } from "react";
import Joyride, { ACTIONS, CallBackProps, EVENTS, STATUS, Step } from "react-joyride";
import { useAuthStore } from "@/store/auth";

const TOUR_KEY = "vaxai_demo_tour_done";

const STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    title: "Welcome to VaxAI Vision",
    content:
      "This is a live demo pre-loaded with real-world vaccine supply chain data. Let's take a quick tour of the key features.",
  },
  {
    target: "[data-tour='nav-overview']",
    placement: "right",
    title: "Operations Overview",
    content:
      "Your command centre: KPIs, stock trends, facility coverage rates, and recent alerts — all in one view.",
  },
  {
    target: "[data-tour='nav-inventory']",
    placement: "right",
    title: "Inventory",
    content:
      "Track stock levels across all facilities. Filter by vaccine type, facility, or country. Spot shortfalls before they become crises.",
  },
  {
    target: "[data-tour='nav-forecast']",
    placement: "right",
    title: "AI Demand Forecasting",
    content:
      "Prophet-powered 90-day demand forecasts with confidence intervals. Select any facility and vaccine to see predicted receipt, issue, and wastage curves.",
  },
  {
    target: "[data-tour='nav-cold-chain']",
    placement: "right",
    title: "Cold Chain Monitoring",
    content:
      "Real-time temperature readings from cold chain sensors. Threshold breaches trigger instant alerts to prevent spoilage.",
  },
  {
    target: "[data-tour='nav-coverage-map']",
    placement: "right",
    title: "Geospatial Coverage Map",
    content:
      "Interactive map showing facility-level immunization coverage rates and stock status. Filter by country, vaccine type, or time period.",
  },
  {
    target: "body",
    placement: "center",
    title: "You're all set!",
    content:
      "Explore freely — all data is pre-loaded and safe to play with. Contact us at hello@vaxaivision.com to discuss a pilot for your organization.",
  },
];

export default function DemoTour() {
  const { email } = useAuthStore();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const isDemo = email === "demo@vaxaivision.com";

  useEffect(() => {
    if (isDemo && !localStorage.getItem(TOUR_KEY)) {
      // Small delay so the layout has rendered
      const t = setTimeout(() => setRun(true), 800);
      return () => clearTimeout(t);
    }
  }, [isDemo]);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { action, index, status, type } = data;

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    } else if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem(TOUR_KEY, "1");
    }
  }, []);

  if (!isDemo) return null;

  return (
    <Joyride
      steps={STEPS}
      run={run}
      stepIndex={stepIndex}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: "#2563eb",
          zIndex: 9999,
        },
        tooltip: {
          borderRadius: 12,
          boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
        },
        buttonNext: {
          borderRadius: 8,
          fontWeight: 600,
        },
        buttonBack: {
          borderRadius: 8,
        },
        buttonSkip: {
          color: "#6b7280",
        },
      }}
    />
  );
}
