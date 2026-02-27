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

    project: {
      findMany: (args?: Parameters<typeof prisma.project.findMany>[0]) =>
        prisma.project.findMany({
          ...args,
          where: { ...args?.where, workspace: { orgId } },
        }),
      findFirst: (args?: Parameters<typeof prisma.project.findFirst>[0]) =>
        prisma.project.findFirst({
          ...args,
          where: { ...args?.where, workspace: { orgId } },
        }),
      findUnique: (args: Parameters<typeof prisma.project.findUnique>[0]) =>
        prisma.project.findUnique(args),
      create: (args: Parameters<typeof prisma.project.create>[0]) =>
        prisma.project.create(args),
      update: (args: Parameters<typeof prisma.project.update>[0]) =>
        prisma.project.update(args),
      delete: (args: Parameters<typeof prisma.project.delete>[0]) =>
        prisma.project.delete(args),
      count: (args?: Parameters<typeof prisma.project.count>[0]) =>
        prisma.project.count({
          ...args,
          where: { ...args?.where, workspace: { orgId } },
        }),
    },

    prompt: {
      findMany: (args?: Parameters<typeof prisma.prompt.findMany>[0]) =>
        prisma.prompt.findMany({
          ...args,
          where: { ...args?.where, project: { workspace: { orgId } } },
        }),
      findFirst: (args?: Parameters<typeof prisma.prompt.findFirst>[0]) =>
        prisma.prompt.findFirst({
          ...args,
          where: { ...args?.where, project: { workspace: { orgId } } },
        }),
      findUnique: (args: Parameters<typeof prisma.prompt.findUnique>[0]) =>
        prisma.prompt.findUnique(args),
      create: (args: Parameters<typeof prisma.prompt.create>[0]) =>
        prisma.prompt.create(args),
      update: (args: Parameters<typeof prisma.prompt.update>[0]) =>
        prisma.prompt.update(args),
      delete: (args: Parameters<typeof prisma.prompt.delete>[0]) =>
        prisma.prompt.delete(args),
      count: (args?: Parameters<typeof prisma.prompt.count>[0]) =>
        prisma.prompt.count({
          ...args,
          where: { ...args?.where, project: { workspace: { orgId } } },
        }),
    },

    promptCluster: {
      findMany: (
        args?: Parameters<typeof prisma.promptCluster.findMany>[0],
      ) =>
        prisma.promptCluster.findMany({
          ...args,
          where: { ...args?.where, project: { workspace: { orgId } } },
        }),
      findFirst: (
        args?: Parameters<typeof prisma.promptCluster.findFirst>[0],
      ) =>
        prisma.promptCluster.findFirst({
          ...args,
          where: { ...args?.where, project: { workspace: { orgId } } },
        }),
      findUnique: (
        args: Parameters<typeof prisma.promptCluster.findUnique>[0],
      ) => prisma.promptCluster.findUnique(args),
      create: (args: Parameters<typeof prisma.promptCluster.create>[0]) =>
        prisma.promptCluster.create(args),
      update: (args: Parameters<typeof prisma.promptCluster.update>[0]) =>
        prisma.promptCluster.update(args),
      delete: (args: Parameters<typeof prisma.promptCluster.delete>[0]) =>
        prisma.promptCluster.delete(args),
      count: (args?: Parameters<typeof prisma.promptCluster.count>[0]) =>
        prisma.promptCluster.count({
          ...args,
          where: { ...args?.where, project: { workspace: { orgId } } },
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
