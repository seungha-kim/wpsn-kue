require('dotenv').config()

const express = require('express')
const multer = require('multer')
const path = require('path')
const cookieSession = require('cookie-session')
const flash = require('connect-flash')
const csurf = require('csurf')
const kue = require('kue')
const morgan = require('morgan')

const query = require('./query')
const mw = require('./middleware')
const image = require('./image')

const PORT = process.env.PORT || 3000

const queue = kue.createQueue()
const app = express()

const upload = multer({
  storage: multer.memoryStorage()
})

app.set('view engine', 'pug')

app.use(morgan('tiny'))
app.use(express.static(path.join(__dirname, '..', 'public')))
app.use(cookieSession({
  name: 'kuesess',
  keys: [process.env.SESSION_SECRET]
}))
app.use(flash())
app.use(mw.insertReq)
app.use(mw.flashError)

const mainRouter = express.Router()
mainRouter.use(upload.single('image'))
mainRouter.use(csurf())
mainRouter.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken()
  next()
})

mainRouter.get('/', (req, res) => {
  query.getCompleteImageEntries()
    .then(entries => {
      res.render('index.pug', {entries})
    })
})

mainRouter.post('/', (req, res) => {
  // 원본 이미지 업로드
  image.uploadOriginalFile(req.file)
    // 데이터베이스에 기록
    .then(location => {
      return query.createImageEntry({
        original_url: location,
        title: req.body.title,
        description: req.body.description
      })
    })
    // 썸네일 작업 생성
    .then(([id]) => {
      return image.createThumbnailJob(queue, id)
    })
    // 리다이렉트
    .then(() => {
      req.flash('info', '성공적으로 업로드 되었습니다. 처리하는 데 약간의 시간이 소요됩니다.')
      res.redirect('/')
    })
})

app.use(mainRouter)

app.listen(PORT, () => {
  console.log(`listening ${PORT}...`)
})
