export const getProperty = (obj, prop) =>
  obj[Object.keys(obj).find((key) => key.toLowerCase() === prop.toLowerCase())];

export const handleError = (error: any) => {
  console.error(error);
  return {
    statusCode: error.code || 500,
    body: JSON.stringify({
      message: JSON.stringify(error),
    }),
  };
};
