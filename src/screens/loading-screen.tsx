import { RocketIcon } from "@radix-ui/react-icons";
import { observer } from "mobx-react-lite";

import { Screen, ScreenContent } from "@/components/ui/screen";

export const LoadingScreen = observer(() => {
  return (
    <Screen className="flex flex-col h-full bg-background">
      <ScreenContent className="flex overflow-y-auto flex-1 justify-center items-center p-4">
        <div className="flex flex-col justify-center items-center space-y-6 text-center">
          <div className="relative">
            <div className="absolute -inset-1 rounded-full animate-ping bg-primary/20" />
            <div className="relative p-4 rounded-full shadow bg-background">
              <RocketIcon className="w-12 h-12 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Loading...
            </h2>
            <p className="text-sm text-muted-foreground">Please wait...</p>
          </div>
          <div className="overflow-hidden w-16">
            <div className="overflow-hidden rounded-full bg-primary/20">
              <div
                className="w-16 h-1 rounded-full bg-primary animate-loading-progress"
                style={{ transformOrigin: 'left' }}
              />
            </div>
          </div>
        </div>
      </ScreenContent>
    </Screen>
  );
});
