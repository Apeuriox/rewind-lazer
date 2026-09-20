import { approachRateToApproachDuration, circleSizeToScale, hitWindowsForOD } from "./difficulty";

test("approachRateToApproachDuration", function () {
  expect(approachRateToApproachDuration(10)).toEqual(450);
  expect(approachRateToApproachDuration(5)).toEqual(1200);
  expect(approachRateToApproachDuration(0)).toEqual(1800);
  expect(approachRateToApproachDuration(11)).toEqual(300);
  expect(approachRateToApproachDuration(-10)).toEqual(3000);
});

test("circleSizeToScale", function () {
  expect(circleSizeToScale(4)).toBeCloseTo(0.57, 5);
  expect(circleSizeToScale(11)).toBeCloseTo(0.08, 5);
});

test("hitWindowsForOD continues past the stable cap of 10", function () {
  expect(hitWindowsForOD(11, true)[0]).toEqual(14);
});
