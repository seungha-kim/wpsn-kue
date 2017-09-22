require('dotenv').config()

const kue = require('kue')
const axios = require('axios')
const sharp = require('sharp')

const query = require('./query')
const image = require('./image')
const queue = kue.createQueue()

queue.process('thumbnail', (job, done) => {
  const {id} = job.data
  // 이미지 항목 정보를 데이터베이스에서 가져온 후
  query.getImageEntryById(id)
    .then(imageEntry => {
      // 원본 이미지 다운로드
      axios.get(imageEntry.original_url, {
        responseType: 'arrayBuffer'
      }).then(res => {
        // 썸네일 생성
        return sharp(res.data)
          .resize(200, 200)
          .crop(sharp.gravity.center)
          .toBuffer()
      }).then(buffer => {
        // 썸네일 업로드
        return image.uploadImageFile(buffer)
      }).then(location => {
        // 이미지 항목의 썸네일 URL 수정
        return query.updateThumbnailUrlByid(id, location)
      }).then(() => {
        done()
      }).catch(err => {
        done(err)
      })
    })
})
