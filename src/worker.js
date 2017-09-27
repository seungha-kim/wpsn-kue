require('dotenv').config()

const kue = require('kue')
const axios = require('axios')
const sharp = require('sharp')

const query = require('./query')
const image = require('./image')
const queue = kue.createQueue()

queue.process('thumbnail', async (job, done) => {
  const {id} = job.data
  try {
    // 이미지 항목 정보를 데이터베이스에서 가져온 후
    const imageEntry = await query.getImageEntryById(id)
    const res = await axios.get(imageEntry.original_url, {
      responseType: 'arraybuffer'
    })
    const buffer = await sharp(res.data)
      .resize(200, 200)
      .crop(sharp.gravity.center)
      .toBuffer()
    const location = await image.uploadImageFile(buffer)
    await query.updateThumbnailUrlByid(id, location)
    done()
  } catch (err) {
    done(err)
  }
})
