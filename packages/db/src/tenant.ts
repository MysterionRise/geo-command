import { prisma } from './index.js'

export function tenantDb(orgId: string) {
  return {
    user: {
      findMany: (args?: Parameters<typeof prisma.user.findMany>[0]) =>
        prisma.user.findMany({ ...args, where: { ...args?.where, orgId } }),
      findFirst: (args?: Parameters<typeof prisma.user.findFirst>[0]) =>
        prisma.user.findFirst({ ...args, where: { ...args?.where, orgId } }),
      findUnique: (args: Parameters<typeof prisma.user.findUnique>[0]) =>
        prisma.user.findUnique(args),
      create: (
        args: Omit<Parameters<typeof prisma.user.create>[0], 'data'> & {
          data: Omit<
            Parameters<typeof prisma.user.create>[0]['data'],
            'orgId'
          >
        },
      ) => prisma.user.create({ ...args, data: { ...args.data, orgId } }),
      update: (args: Parameters<typeof prisma.user.update>[0]) =>
        prisma.user.update(args),
      delete: (args: Parameters<typeof prisma.user.delete>[0]) =>
        prisma.user.delete(args),
      count: (args?: Parameters<typeof prisma.user.count>[0]) =>
        prisma.user.count({ ...args, where: { ...args?.where, orgId } }),
    },

    workspace: {
      findMany: (args?: Parameters<typeof prisma.workspace.findMany>[0]) =>
        prisma.workspace.findMany({
          ...args,
          where: { ...args?.where, orgId },
        }),
      findFirst: (args?: Parameters<typeof prisma.workspace.findFirst>[0]) =>
        prisma.workspace.findFirst({
          ...args,
          where: { ...args?.where, orgId },
        }),
      findUnique: (args: Parameters<typeof prisma.workspace.findUnique>[0]) =>
        prisma.workspace.findUnique(args),
      create: (
        args: Omit<Parameters<typeof prisma.workspace.create>[0], 'data'> & {
          data: Omit<
            Parameters<typeof prisma.workspace.create>[0]['data'],
            'orgId'
          >
        },
      ) =>
        prisma.workspace.create({ ...args, data: { ...args.data, orgId } }),
      update: (args: Parameters<typeof prisma.workspace.update>[0]) =>
        prisma.workspace.update(args),
      delete: (args: Parameters<typeof prisma.workspace.delete>[0]) =>
        prisma.workspace.delete(args),
      count: (args?: Parameters<typeof prisma.workspace.count>[0]) =>
        prisma.workspace.count({ ...args, where: { ...args?.where, orgId } }),
    },

    invitation: {
      findMany: (args?: Parameters<typeof prisma.invitation.findMany>[0]) =>
        prisma.invitation.findMany({
          ...args,
          where: { ...args?.where, orgId },
        }),
      findFirst: (args?: Parameters<typeof prisma.invitation.findFirst>[0]) =>
        prisma.invitation.findFirst({
          ...args,
          where: { ...args?.where, orgId },
        }),
      findUnique: (args: Parameters<typeof prisma.invitation.findUnique>[0]) =>
        prisma.invitation.findUnique(args),
      create: (
        args: Omit<Parameters<typeof prisma.invitation.create>[0], 'data'> & {
          data: Omit<
            Parameters<typeof prisma.invitation.create>[0]['data'],
            'orgId'
          >
        },
      ) =>
        prisma.invitation.create({ ...args, data: { ...args.data, orgId } }),
      update: (args: Parameters<typeof prisma.invitation.update>[0]) =>
        prisma.invitation.update(args),
      delete: (args: Parameters<typeof prisma.invitation.delete>[0]) =>
        prisma.invitation.delete(args),
      count: (args?: Parameters<typeof prisma.invitation.count>[0]) =>
        prisma.invitation.count({
          ...args,
          where: { ...args?.where, orgId },
        }),
    },

    organisation: {
      findUnique: () =>
        prisma.organisation.findUnique({ where: { id: orgId } }),
      update: (
        args: Omit<Parameters<typeof prisma.organisation.update>[0], 'where'>,
      ) => prisma.organisation.update({ ...args, where: { id: orgId } }),
    },
  }
}
