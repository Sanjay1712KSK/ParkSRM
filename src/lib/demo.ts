import type { AppState, TimetableSession } from './types'
const today = new Date()
const nextWeekday = (day: string) => {
  const target = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(day)
  const date = new Date(today); let delta = (target - date.getDay() + 7) % 7; if (delta === 0) delta = 7
  date.setDate(date.getDate() + delta); return date.toISOString().slice(0,10)
}
export const sampleTimetable: TimetableSession[] = [
  {id:'c1',day:'Monday',start:'08:00',end:'09:45',course:'Neural Networks',location:'TP-401'},
  {id:'c2',day:'Monday',start:'12:00',end:'13:45',course:'Compiler Design',location:'TP-203'},
  {id:'c3',day:'Tuesday',start:'09:00',end:'10:40',course:'Machine Learning',location:'TP-302'},
  {id:'c4',day:'Tuesday',start:'13:00',end:'14:40',course:'Cloud Computing',location:'TP-105'},
  {id:'c5',day:'Wednesday',start:'08:00',end:'09:45',course:'Deep Learning',location:'TP-401'},
  {id:'c6',day:'Wednesday',start:'11:00',end:'12:40',course:'Compiler Design Lab',location:'Lab-3'},
  {id:'c7',day:'Thursday',start:'10:00',end:'11:40',course:'Computer Vision',location:'TP-202'},
  {id:'c8',day:'Friday',start:'08:00',end:'09:45',course:'Project Work',location:'ISD Lab'},
]
export const initialState: AppState = {
  profile: null,
  zones: [
    {id:'north',name:'North Campus',area:'Near Tech Park',total:120,occupied:78,vehicleTypes:['two-wheeler','four-wheeler']},
    {id:'main',name:'Main Block',area:'Academic Block entrance',total:85,occupied:62,vehicleTypes:['two-wheeler']},
    {id:'library',name:'Library Zone',area:'Central Library',total:60,occupied:21,vehicleTypes:['two-wheeler','four-wheeler']},
    {id:'hostel',name:'Hostel Connector',area:'Near campus connector',total:100,occupied:91,vehicleTypes:['two-wheeler']},
  ],
  timetable: sampleTimetable, reservations: [], ledger: [], credits:100, onboardingComplete:false,
}
export const demoDate = nextWeekday('Monday')
