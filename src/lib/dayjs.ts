import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

// All date arithmetic in this app is UTC so calendar days are consistent
// between server (UTC) and client (any timezone).
dayjs.extend(utc)

export default dayjs
