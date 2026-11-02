import { describe, expect, it } from 'vitest'
import { eligibleWindows, validateSessions } from './time'
import type { TimetableSession } from './types'
describe('schedule-aware parking windows',()=>{
 it('merges class sessions across a free gap so the vehicle can stay parked',()=>{
  const rows:TimetableSession[]=[
   {id:'1',day:'Monday',start:'08:00',end:'09:45',course:'A'},
   {id:'2',day:'Monday',start:'12:00',end:'13:45',course:'B'},
  ]
  expect(eligibleWindows(rows,'Monday').map(x=>[x.start,x.end])).toEqual([['08:00','13:45']])
 })
 it('does not offer a parking window on a day without classes',()=>{
  expect(eligibleWindows([], 'Sunday')).toEqual([])
 })
 it('splits sessions separated by more than the configured gap',()=>{
  const rows:TimetableSession[]=[{id:'1',day:'Monday',start:'08:00',end:'09:00',course:'A'},{id:'2',day:'Monday',start:'15:00',end:'16:00',course:'B'}]
  expect(eligibleWindows(rows,'Monday').map(x=>x.start)).toEqual(['08:00','15:00'])
 })
 it('rejects end times earlier than start times',()=>{
  expect(validateSessions([{id:'x',day:'Monday',start:'12:00',end:'10:00',course:'Test'}])).toContain('Row 1: end must be after start')
 })
})
