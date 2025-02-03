import { observer } from "mobx-react-lite";

import { LoadingWrapper } from "@/components/loading-wrapper";
import {
  Screen,
  ScreenContent,
  ScreenHeader,
  ScreenTitle,
} from "@/components/ui/screen";
import { useGrispi } from "@/contexts/grispi-context";
import { LoadingScreen } from "./loading-screen";

export const WelcomeScreen = observer(() => {
  const { ticket, loading } = useGrispi();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Screen>
      <ScreenHeader>
        <ScreenTitle>Grispi</ScreenTitle>
      </ScreenHeader>
      <ScreenContent>
        <div className="flex flex-col gap-3 p-6">
          <span className="text-xs font-bold text-center uppercase text-primary">
            Welcome to starter
          </span>
          <div className="flex flex-col divide-y *:py-2 *:text-xs">
            <div className="flex justify-between items-center">
              <span>Key</span>
              <span className="font-bold">{ticket?.key}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Time</span>
              <span className="font-bold">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </ScreenContent>
    </Screen>
  );
});
