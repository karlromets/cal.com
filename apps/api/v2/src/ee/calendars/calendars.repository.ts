import { PrismaReadService } from "@/modules/prisma/prisma-read.service";
import { PrismaWriteService } from "@/modules/prisma/prisma-write.service";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export const credentialForCalendarRepositorySelect = Prisma.validator<Prisma.CredentialSelect>()({
  id: true,
  appId: true,
  type: true,
  userId: true,
  user: {
    select: {
      email: true,
    },
  },
  teamId: true,
  key: true,
  invalid: true,
});

@Injectable()
export class CalendarsRepository {
  constructor(private readonly dbRead: PrismaReadService, private readonly dbWrite: PrismaWriteService) {}

  async getCalendarCredentials(credentialId: number, userId: number) {
    return await this.dbRead.prisma.credential.findFirst({
      where: {
        id: credentialId,
        userId,
      },
      select: {
        ...credentialForCalendarRepositorySelect,
        app: {
          select: {
            slug: true,
            categories: true,
            dirName: true,
          },
        },
      },
    });
  }

  async deleteCredentials(credentialType: string, userId: number, calendarIds: string[] | undefined) {
    await this.dbWrite.prisma.selectedCalendar.deleteMany({
      where: {
        userId,
        integration: credentialType,
        externalId: {
          in: calendarIds,
        },
      },
    });
  }
}
