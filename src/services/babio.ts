import axios, {Axios} from 'axios'
import cheerio from 'cheerio'
import * as fs from 'fs'
import {Artist, Album} from '../types/types'
import FormData from 'form-data'
import ProgressBar from 'progress'
import cli from 'cli-ux'
import {resolve} from 'path'

export class Babio {
  api: Axios

  constructor() {
    this.api = axios.create({baseURL: 'https://m.babiorap.net/'})
  }

  public async searchArtist(artistName: string): Promise<Artist[]> {
    const {data: html} = await this.api.get(`/artistes?az=${artistName}`)

    const $ = cheerio.load(html)
    const artists = $('.card-body .row .col-md-3')

    return artists.map((i, el) => {
      const h4 = $(el).find('h4')
      const name = h4.text()
      const url = h4.find('a').attr('href') as string

      return {name, url: this.api.defaults.baseURL + url}
    }).toArray()
  }

  public async getArtistAlbums(artist: Artist): Promise<Album[]> {
    const {data: html} = await this.api.get(artist.url)

    const $ = cheerio.load(html)
    const albums = $('#my-posts .row .col-xl-6')

    return albums.map((i, el) => {
      const h5 = $(el).find('h5')
      const name = h5.text()
      const url = h5.find('a').attr('href') as string

      return {name, url}
    }).toArray()
  }

  public async downloadAlbum(album: Album, destination = './'): Promise<void> {
    cli.action.start('Generating ZIP file')
    const genZipUrl = await this.getDownloadPageUrl(album)
    const dlUrl = await this.generateZipFile(genZipUrl)
    cli.action.stop()

    await this.downloadZipFile(album, dlUrl, destination)
  }

  private async downloadZipFile(album: Album, dlUrl: string, destination: string): Promise<void> {
    const {data, headers} = await axios.get(encodeURI(dlUrl), {responseType: 'stream'})

    const totalLength = headers['content-length']
    const progressBar = new ProgressBar('-> downloading [:bar] :percent :etas', {
      width: 40,
      complete: '=',
      incomplete: ' ',
      renderThrottle: 1,
      total: parseInt(totalLength, 10),
    })

    const filename = album.name.replace(/[/\\?%*:|"<>]/g, '-') + '.zip'
    const writer = fs.createWriteStream(resolve(destination + filename))

    data.on('data', (chunk: any) => progressBar.tick(chunk.length))
    data.pipe(writer)

    data.on('end', () => console.log('\nDownload finished'))
  }

  private async getDownloadPageUrl(album: Album) {
    const {data: html} = await this.api.get(album.url)

    const $ = cheerio.load(html)
    const downloadPageUrl = $('#my-posts .text-center a.btn-primary').attr('href') as string
    return this.api.defaults.baseURL + downloadPageUrl
  }

  private async generateZipFile(genZipUrl: string) {
    const {data: html} = await this.api.get(genZipUrl)

    const $ = cheerio.load(html)
    const downloadBtn = $('#telecharger')
    const albumId = downloadBtn.attr('data-id') as string
    const cover = downloadBtn.attr('data-cover') as string

    const bodyFormData = new FormData()

    bodyFormData.append('cover', cover)
    bodyFormData.append('id', albumId)

    const response = await this.api.post('ajax/dl-album.ajax', bodyFormData, {
      headers: {
        'Content-Type': `multipart/form-data;  boundary=${bodyFormData._boundary}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36',
        Accept: '*/*',
      },
    })

    if (response.data.length === 0) {
      throw new Error('Error while generating ZIP File')
    }

    return response.data
  }
}
