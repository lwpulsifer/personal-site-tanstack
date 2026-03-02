export const WORKOUT_TYPES = ['Run', 'Bike', 'Swim', 'Lift', 'Walk', 'Yoga', 'Other'] as const
export type WorkoutType = (typeof WORKOUT_TYPES)[number]

export const WORKOUT_TYPE_ABBR: Record<WorkoutType, string> = {
  Run: 'RUN',
  Bike: 'BIKE',
  Swim: 'SWIM',
  Lift: 'LIFT',
  Walk: 'WALK',
  Yoga: 'YOGA',
  Other: 'OTH',
}

// Strava sport_type / type → WorkoutType
export const STRAVA_TYPE_MAP: Record<string, WorkoutType> = {
  Run: 'Run',
  TrailRun: 'Run',
  VirtualRun: 'Run',
  Ride: 'Bike',
  VirtualRide: 'Bike',
  MountainBikeRide: 'Bike',
  EBikeRide: 'Bike',
  Swim: 'Swim',
  WeightTraining: 'Lift',
  Crossfit: 'Lift',
  Walk: 'Walk',
  Hike: 'Walk',
  Yoga: 'Yoga',
}
