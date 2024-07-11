import { EmailsService } from "@/modules/email/emails.service";
import { CreateOrganizationUserInput } from "@/modules/organizations/inputs/create-organization-user.input";
import { UpdateOrganizationUserInput } from "@/modules/organizations/inputs/update-organization-user.input";
import { OrganizationsUsersRepository } from "@/modules/organizations/repositories/organizations-users.repository";
import { CreateUserInput } from "@/modules/users/inputs/create-user.input";
import { Injectable, ConflictException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";

import {
  createNewUsersConnectToOrgIfExists,
  sendSignupToOrganizationEmail,
  getTranslation,
} from "@calcom/platform-libraries";
import { Team } from "@calcom/prisma/client";

@Injectable()
export class OrganizationsUsersService {
  constructor(
    private readonly organizationsUsersRepository: OrganizationsUsersRepository,
    private readonly emailsService: EmailsService
  ) {}

  async getOrganizationUsers(orgId: number, emailInput?: string | string[]) {
    const emailArray = !emailInput ? [] : Array.isArray(emailInput) ? emailInput : [emailInput];

    const users = await this.organizationsUsersRepository.getOrganizationUsers(orgId, emailArray);

    return users;
  }

  async createOrganizationUser(org: Team, userCreateBody: CreateOrganizationUserInput) {
    // Check if email exists in the system
    const userEmailCheck = await this.organizationsUsersRepository.getOrganizationUserByEmail(
      org.id,
      userCreateBody.email
    );

    if (userEmailCheck) throw new ConflictException("A user already exists with that email");

    // Check if username is already in use in the org
    if (userCreateBody.username) {
      await this.checkForUsernameConflicts(org.id, userCreateBody.username);
    }

    const usernameOrEmail = userCreateBody.username ? userCreateBody.username : userCreateBody.email;

    // Create new org user
    const createdUserCall = await createNewUsersConnectToOrgIfExists({
      invitations: [
        {
          usernameOrEmail: usernameOrEmail,
          role: userCreateBody.organizationRole,
        },
      ],
      teamId: org.id,
      isOrg: true,
      parentId: null,
      autoAcceptEmailDomain: "not-required-for-this-endpoint",
      orgConnectInfoByUsernameOrEmail: {
        [usernameOrEmail]: {
          orgId: org.id,
          autoAccept: userCreateBody.autoAccept,
        },
      },
    });

    const createdUser = createdUserCall[0];

    // Update user fields that weren't included in createNewUsersConnectToOrgIfExists
    const updateUserBody = plainToInstance(CreateUserInput, userCreateBody, { strategy: "excludeAll" });

    // Update new user with other userCreateBody params
    const user = await this.organizationsUsersRepository.updateOrganizationUser(
      org.id,
      createdUser.id,
      updateUserBody
    );

    // Need to send email to new user to create password
    await this.emailsService.sendSignupToOrganizationEmail({
      usernameOrEmail,
      orgName: org.name,
      orgId: org.id,
      locale: user?.locale,
    });

    return user;
  }

  async updateOrganizationUser(orgId: number, userId: number, userUpdateBody: UpdateOrganizationUserInput) {
    if (userUpdateBody.username) {
      await this.checkForUsernameConflicts(orgId, userUpdateBody.username);
    }

    const user = await this.organizationsUsersRepository.updateOrganizationUser(
      orgId,
      userId,
      userUpdateBody
    );
    return user;
  }

  async deleteOrganizationUser(orgId: number, userId: number) {
    const user = await this.organizationsUsersRepository.deleteUser(orgId, userId);
    return user;
  }

  async checkForUsernameConflicts(orgId: number, username: string) {
    const isUsernameTaken = await this.organizationsUsersRepository.getOrganizationUserByUsername(
      orgId,
      username
    );

    if (isUsernameTaken) throw new ConflictException("Username is already taken");
  }
}
