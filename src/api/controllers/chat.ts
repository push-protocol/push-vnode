import { NextFunction, Request, Response } from 'express'
import Container from 'typedi'

import { MessageDTO, RejectIntent, UpdateIntent } from '../../interfaces/chat'
import ChatService from '../../services/chatService'

export async function createMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  const chatService = Container.get(ChatService)
  const message: MessageDTO = {
    fromCAIP10: req.body.fromCAIP10,
    toCAIP10: req.body.toCAIP10,
    fromDID: req.body.fromDID,
    toDID: req.body.toDID,
    ...(req.body.messageObj && { messageObj: req.body.messageObj }),
    // deprecated
    messageContent: req.body.messageContent,
    messageType: req.body.messageType,
    timestamp: Date.now(),
    encType: req.body.encType,
    encryptedSecret: req.body.encryptedSecret,
    // deprecated
    signature: req.body.signature,
    // deprecated
    sigType: req.body.sigType,
    verificationProof: req.body.verificationProof
      ? req.body.verificationProof
      : `${req.body.sigType}:${req.body.signature}`,
    sessionKey: req.body.sessionKey
  }
  const result = await chatService.createMessage(message)
  if (result.success) {
    return res.status(201).json(result.data)
  } else {
    if (result.error.includes('Access denied')) {
      return res.status(403).send(result.error)
    }
    return res.status(400).send(result.error)
  }
}

export async function createIntent(req: Request, res: Response, next: NextFunction) {
  const chatService = Container.get(ChatService)
  const intent: MessageDTO = {
    fromDID: req.body.fromDID,
    toDID: req.body.toDID,
    ...(req.body.messageObj && { messageObj: req.body.messageObj }),
    //deprecated
    messageContent: req.body.messageContent,
    messageType: req.body.messageType,
    timestamp: Date.now(),
    fromCAIP10: req.body.fromCAIP10,
    toCAIP10: req.body.toCAIP10,
    encryptedSecret: req.body.encryptedSecret,
    encType: req.body.encType,
    // deprecated
    signature: req.body.signature,
    // deprecated
    sigType: req.body.sigType,
    verificationProof: req.body.verificationProof
      ? req.body.verificationProof
      : `${req.body.sigType}:${req.body.signature}`,
    sessionKey: req.body.sessionKey
  }
  const result = await chatService.createIntent(intent)
  if (result.success) {
    return res.status(201).json(result.data)
  } else {
    if (result.error.includes('Access denied')) {
      return res.status(403).send(result.error)
    }
    return res.status(400).send(result.error)
  }
}

export async function updateIntent(req: Request, res: Response, next: NextFunction) {
  const chatService = Container.get(ChatService)
  const intent: UpdateIntent = {
    fromDID: req.body.fromDID,
    toDID: req.body.toDID,
    signature: req.body.verificationProof
      ? req.body.verificationProof.split(':')[1]
      : req.body.signature,
    sigType: req.body.verificationProof
      ? req.body.verificationProof.split(':')[0]
      : req.body.sigType,
    status: req.body.status,
    verificationProof: req.body.verificationProof,
    encryptedSecret: req.body.encryptedSecret
  }
  const result = await chatService.updateIntent(intent)
  if (result.success) {
    return res.status(201).json(result.data)
  } else {
    if (result.error.includes('Access denied')) {
      return res.status(403).send(result.error)
    }
    return res.status(400).send(result.error)
  }
}

export async function rejectIntent(req: Request, res: Response, next: NextFunction) {
  const chatService = Container.get(ChatService)
  const intent: RejectIntent = {
    fromDID: req.body.fromDID,
    toDID: req.body.toDID,
    verificationProof: req.body.verificationProof
  }
  const result = await chatService.rejectIntent(intent)
  if (result.success) {
    return res.status(200).json(result)
  } else {
    if (result.error.includes('Access denied')) {
      return res.status(403).send(result.error)
    }
    return res.status(400).send(result.error)
  }
}
