import { useNavigation } from "react-router";

/**
 * Thin top progress bar shown while React Router is loading a route or running
 * an action, so page transitions never look frozen.
 */
export function RouteLoadingIndicator() {
  const navigation = useNavigation();
  const isActive = navigation.state !== "idle";

  return (
    <div
      aria-hidden="true"
      className={`counterpulse-route-progress${
        isActive ? " counterpulse-route-progress--active" : ""
      }`}
    >
      <div className="counterpulse-route-progress__bar" />
    </div>
  );
}
