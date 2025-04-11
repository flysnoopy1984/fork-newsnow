import type { SourceID, SourceResponse } from "@shared/types"
import { getters } from "#/getters"
import { getCacheTable } from "#/database/cache"
import { sources } from "@shared/sources"
import { getQuery } from "h3"
import { defineEventHandler, createError } from "h3"
import { logger } from "#/utils/logger"

export default defineEventHandler(async (event): Promise<SourceResponse> => {
  try {
    const query = getQuery(event)
    let id = query.id as SourceID
    const isValid = (id: SourceID) => !id || !sources[id] || !getters[id]

    if (isValid(id)) {
      const redirectID = sources?.[id]?.redirect
      if (redirectID) id = redirectID
      if (isValid(id)) throw new Error("Invalid source id")
    }

    // 直接获取最新数据
    try {
      const newData = (await getters[id]()).slice(0, 30)
      const cacheTable = await getCacheTable()
      if (cacheTable && newData.length) {
        if (event.context.waitUntil) event.context.waitUntil(cacheTable.set(id, newData))
        else await cacheTable.set(id, newData)
      }
      logger.success(`fetch ${id} latest`)
      return {
        status: "success",
        id,
        updatedTime: Date.now(),
        items: newData,
      }
    } catch (e) {
      throw createError({
        statusCode: 500,
        message: e instanceof Error ? e.message : "Failed to fetch data",
      })
    }
  } catch (e: any) {
    logger.error(e)
    throw createError({
      statusCode: 500,
      message: e instanceof Error ? e.message : "Internal Server Error",
    })
  }
})
