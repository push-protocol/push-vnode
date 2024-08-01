export type IFeed = {
  payloadId: number
  sender: string
  epoch: string
  source: string
  etime: string
  payload: IFeedPayload
}

export type IFeedPayload = {
  data: {
    app: string
    sid: string
    url: string
    acta: string
    aimg: string
    amsg: string
    asub: string
    icon: string
    type: number
    epoch: string
    etime: null | string
    hidden: string
    silent: string
    sectype: null | string
    additionalMeta: {
      data: any
      domain: string
      type: string
    } | null
  }
  recipients: string | string[] | { [key: string]: null }
  notification: {
    body: string
    title: string
  }
  verificationProof: string
}
