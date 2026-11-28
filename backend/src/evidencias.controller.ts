import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { MAX_FILE_SIZE } from './dto/evidencia.dto'
import { EvidencesService } from './evidencias.service'
import { UploadedFileDto } from './dto/evidencia.dto'

interface HttpResponse {
  setHeader(name: string, value: string): void
  redirect(url: string): void
}

@Controller()
export class EvidencesController {
  constructor(private readonly evidences: EvidencesService) {}

  @Post('sesiones/:id/resultados/:tareaId/evidencias')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 4, fieldSize: 4096 } }))
  async upload(
    @Param('id') sessionId: string,
    @Param('tareaId') taskId: string,
    @UploadedFile() file: UploadedFileDto | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    if (file) {
      return this.evidences.createFromFile(
        sessionId,
        taskId,
        file,
        body?.descripcion,
      )
    }

    if (body && (body.tipo === 'enlace' || body.ruta || body.url)) {
      return this.evidences.createFromLink(sessionId, taskId, {
        tipo: 'enlace',
        ruta: body.ruta || body.url,
        descripcion: body.descripcion,
      })
    }

    throw new BadRequestException('Debes adjuntar un archivo válido o proporcionar un enlace.')
  }

  @Get('sesiones/:id/resultados/:tareaId/evidencias')
  async listByTask(
    @Param('id') sessionId: string,
    @Param('tareaId') taskId: string,
  ) {
    return this.evidences.listByTask(sessionId, taskId)
  }

  @Get('sesiones/:id/evidencias')
  async listBySession(@Param('id') sessionId: string) {
    return this.evidences.listBySession(sessionId)
  }

  @Get('evidencias/:id')
  async getDetail(@Param('id') id: string) {
    return this.evidences.getDetail(id)
  }

  @Get('evidencias/:id/acceso')
  async access(@Param('id') id: string) {
    const info = await this.evidences.getFile(id)
    return { url: info.url }
  }

  @Get('evidencias/:id/archivo')
  async streamFile(@Param('id') id: string, @Res() res: HttpResponse) {
    const info = await this.evidences.getFile(id)
    return res.redirect(info.url)
  }

  @Delete('evidencias/:id')
  async remove(@Param('id') id: string) {
    return this.evidences.delete(id)
  }
}
