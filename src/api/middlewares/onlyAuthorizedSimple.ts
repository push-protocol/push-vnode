/**
 * @param {*} req Express req Object
 * @param {*} res  Express res Object
 * @param {*} next  Express next Function
 * @param {*} op_to_match  Operation to Match
 */
const onlyAuthorized = async (req, res, next, opToValidate) => {
  try {
    if (req.body.op !== opToValidate) {
      return res.status(401).json({ info: 'Operation mismatched' })
    }

    return next()
  } catch (e) {
    throw e
    return next(e)
  }
}

export default onlyAuthorized
