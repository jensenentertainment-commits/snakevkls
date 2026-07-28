type PickResource = {
  status: string;
  assignedTo: string | null;
};

export function canReadViperPick(
  resource: PickResource,
  actorId: string
): boolean {
  return (
    resource.status === "ready" ||
    (resource.status === "in_progress" &&
      resource.assignedTo === actorId)
  );
}

export function canStartViperPick(
  resource: PickResource,
  actorId: string
): boolean {
  return canReadViperPick(resource, actorId);
}
