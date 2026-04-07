import { useEffect, useState } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";

const TOUR_DONE_KEY = "vaxai_tour_done";

const steps: Step[] = [
  {
    target: "body",
    content: "Welcome to VaxAI Vision! This guided tour will walk you through the key features of the platform.",
    placement: "center",
    disableBeacon: true,
    title: "Welcome to VaxAI Vision 👋",
  },
  {
    target: "a[href='/inventory']",
    content: "The Inventory dashboard shows real-time stock levels with adequate, low, and critical alerts per facility.",
    title: "Inventory Intelligence",
    disableBeacon: true,
  },
  {
    target: "a[href='/coverage-map']",
    content: "The Coverage Map shows immunization coverage rates and vaccine stock across facilities on an interactive map.",
    title: "Geospatial Coverage Map",
    disableBeacon: true,
  },
  {
    target: "a[href='/forecast']",
    content: "The Forecasting page uses AI to predict future vaccine demand and flag potential stockouts before they happen.",
    title: "Demand Forecasting",
    disableBeacon: true,
  },
];

export default function DemoTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tourDone = localStorage.getItem(TOUR_DONE_KEY);
    if (params.get("demo") === "true" && !tourDone) {
      setRun(true);
    }
  }, []);

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      localStorage.setItem(TOUR_DONE_KEY, "true");
      setRun(false);
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={handleCallback}
      locale={{ last: "End Tour" }}
      styles={{
        options: {
          primaryColor: "#3A5BCC",
          zIndex: 10000,
        },
      }}
    />
  );
}
