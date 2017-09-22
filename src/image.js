require('dotenv').config()

const aws = require('aws-sdk')
const uuid = require('uuid')
const fileType = require('file-type')

const s3 = new aws.S3({
  apiVersion: '2006-03-01'
})

const supportedImageExt = ['png', 'jpg']

/**
 * S3에 이미지를 업로드합니다.
 * @param {Buffer} buffer
 * @returns {Promise}
 */
function uploadImageFile(buffer) {
  return new Promise((resolve, reject) => {
    // 파일 타입 체크해서 png, jpg가 아니면 에러 발생
    const {ext, mime} = fileType(buffer)
    if (!supportedImageExt.includes(ext)) {
      return reject(new Error('지원하는 파일 형식이 아닙니다.'))
    }
    // s3에 업로드 후 Location 반환
    s3.upload({
      ACL: 'public-read', // 익명의 사용자도 파일 경로만 알면 읽기 가능하도록 설정
      Body: buffer,
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `${uuid.v4()}.${ext}`,
      ContentDisposition: 'inline', // Content-Disposition 헤더
      ContentType: mime // Content-Type 헤더
    }, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data.Location)
      }
    })
  })
}

/**
 * 사용자로부터 받은 이미지 파일의 크기를 검사한 후 S3에 업로드합니다.
 * @param file - multer 파일 객체 https://www.npmjs.com/package/multer#file-information
 * @returns {Promise}
 */
function uploadOriginalFile(file) {
  return new Promise((resolve, reject) => {
    // 1MB 보다 크면 에러 발생
    if (file.size > 1024 * 1024) {
      reject(new Error('파일의 크기는 1MB를 넘을 수 없습니다.'))
    } else {
      // 이미지 업로드
      resolve(uploadImageFile(file.buffer))
    }
  })
}

/**
 * 썸네일 생성 작업을 작업 큐에 추가합니다.
 * @param queue - kue queue 인스턴스
 * @param {string} location - S3에 업로드된 파일의 public url
 * @returns {Promise}
 */
function createThumbnailJob(queue, id) {
  return new Promise((resolve, reject) => {
    queue.create('thumbnail', {id})
      .removeOnComplete(true)
      .save(err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
  })
}

module.exports = {
  createThumbnailJob,
  uploadOriginalFile,
  uploadImageFile
}
