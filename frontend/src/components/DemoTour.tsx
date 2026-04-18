import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Joyride, { ACTIONS, CallBackProps, EVENTS, STATUS, Step } from "react-joyride";
import { useAuthStore } from "@/store/auth";

const TOUR_KEY = "vaxai_demo_tour_done";

function useTourSteps(): Step[] {
  const { t } = useTranslation();
  return [
    {
      target: "body",
      placement: "center",
      disableBeacon: true,
      title: t("tour.welcomeTitle"),
      content: t("tour.welcomeContent"),
    },
    {
      target: "[data-tour='nav-overview']",
      placement: "right",
      title: t("tour.overviewTitle"),
      content: t("tour.overviewContent"),
    },
    {
      target: "[data-tour='nav-inventory']",
      placement: "right",
      title: t("tour.inventoryTitle"),
      content: t("tour.inventoryContent"),
    },
    {
      target: "[data-tour='nav-forecast']",
      placement: "right",
      title: t("tour.forecastTitle"),
      content: t("tour.forecastContent"),
    },
    {
      target: "[data-tour='nav-cold-chain']",
      placement: "right",
      title: t("tour.coldChainTitle"),
      content: t("tour.coldChainContent"),
    },
    {
      target: "[data-tour='nav-coverage-map']",
      placement: "right",
      title: t("tour.coverageTitle"),
      content: t("tour.coverageContent"),
    },
    {
      target: "body",
      placement: "center",
      title: t("tour.doneTitle"),
      content: t("tour.doneContent"),
    },
  ];
}

export default function DemoTour() {
  const { email } = useAuthStore();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const steps = useTourSteps();

  const isDemo = email === "partnerships@vaxaivision.com";

  useEffect(() => {
    if (isDemo && !localStorage.getItem(TOUR_KEY)) {
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
      steps={steps}
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
