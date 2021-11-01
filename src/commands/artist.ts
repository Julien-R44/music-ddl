import {Command, flags} from '@oclif/command'
import {Babio} from '../services/babio'
import cli from 'cli-ux'
import * as inquirer from 'inquirer'
import {Artist as IArtist, Album} from '../types/types'
import {resolve} from 'path'
import chalk from 'chalk'
import figlet, {Fonts} from 'figlet'
import gradient from 'gradient-string'

export default class Artist extends Command {
  static description = "Download an album from the artist's discography"

  static examples = [
    '$ music-ddl album kanye',
    '$ music-ddl album',
  ]

  static flags = {
    dest: flags.string({
      char: 'd',
      description: 'destination directory',
      default: './',
    }),
  }

  static args = [{name: 'artistName'}]

  async run() {
    const ascii = figlet.textSync('Music-DDL', {font: 'Speed', horizontalLayout: 'full'}) + '\n'

    console.log(gradient.mind(ascii))

    const {args, flags} = this.parse(Artist)
    const babio = new Babio()

    const destination = resolve(flags.dest)

    let artistName = args.artistName
    if (!artistName) {
      artistName = await cli.prompt('Which artist are you searching for?')
    }

    cli.action.start(`searching artists : ${artistName}`)
    const artists = await babio.searchArtist(artistName)
    cli.action.stop()

    let responses: any = await inquirer.prompt([{
      name: 'artist',
      message: 'Which artist is the one your looking for ?',
      type: 'list',
      choices: artists,
    }])

    const artist = artists.find(a => a.name === responses.artist) as IArtist

    cli.action.start(`searching albums for ${artist.name}`)
    const albums = await babio.getArtistAlbums(artist)
    cli.action.stop()

    responses = await inquirer.prompt([{
      name: 'album',
      message: 'Which album do you want to download ?',
      type: 'list',
      choices: albums.map(a => a.name),
    }])

    const album = albums.find(a => a.name === responses.album) as Album

    await babio.downloadAlbum(album, destination)
  }
}
