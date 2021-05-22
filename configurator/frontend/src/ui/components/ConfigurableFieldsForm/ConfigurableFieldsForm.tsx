// @Libs
import React, { useCallback, useState } from 'react';
import { Col, Form, Input, Modal, Row, Select, Switch } from 'antd';
import debounce from 'lodash/debounce';
import get from 'lodash/get';
import cn from 'classnames';
// @Components
import { LabelWithTooltip } from '@component/LabelWithTooltip/LabelWithTooltip';
import { CodeDebugger } from '@component/CodeDebugger/CodeDebugger';
import { EditableList } from '@./lib/components/EditableList/EditableList';
import { CodeEditor } from '@component/CodeEditor/CodeEditor';
// @Types
import { Parameter, ParameterType } from '@catalog/sources/types';
import { FormInstance } from 'antd/lib/form/hooks/useForm';
// @Utils
import { makeObjectFromFieldsValues } from '@util/forms/marshalling';
import { isoDateValidator } from '@util/validation/validators';
// @Hooks
import { useForceUpdate } from '@hooks/useForceUpdate';
// @Icons
import EyeTwoTone from '@ant-design/icons/lib/icons/EyeTwoTone';
import EyeInvisibleOutlined from '@ant-design/icons/lib/icons/EyeInvisibleOutlined';
import CaretRightOutlined from '@ant-design/icons/lib/icons/CaretRightOutlined';
// @Styles
import styles from './ConfigurableFieldsForm.module.less';
// @Services
import ApplicationServices from '@service/ApplicationServices';

export interface Props {
  fieldsParamsList: Parameter[];
  form: FormInstance;
  initialValues: any;
  namePrefix?: string;
  handleTouchAnyField: VoidFunc;
}

const ConfigurableFieldsForm = ({ fieldsParamsList, form, initialValues, handleTouchAnyField }: Props) => {
  const services = ApplicationServices.get();

  const [tableNameModal, switchTableNameModal] = useState<boolean>(true);

  const handleTouchField = debounce(handleTouchAnyField, 1000);

  const forceUpdate = useForceUpdate();

  const handleChangeIntInput = useCallback((id: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');

    form.setFieldsValue({ [id]: value });
  }, [form]);

  const handleChangeSwitch = useCallback((id: string) => (value: boolean) => {
    form.setFieldsValue({ [id]: value });

    forceUpdate();
  }, [form, forceUpdate]);

  const handleJsonChange = (id: string) => (value: string) => {
    form.setFieldsValue({ [id]: value ? value : '' });

    handleTouchField();
  };

  const getFieldComponent = useCallback((type: ParameterType<any>, id: string) => {
    const fieldsValue = form.getFieldsValue();

    switch (type?.typeName) {
    case 'password':
      return <Input.Password
        autoComplete="off"
        iconRender={visible => visible
          ? <EyeTwoTone />
          : <EyeInvisibleOutlined />}
      />;

    case 'int':
      return <Input autoComplete="off" onChange={handleChangeIntInput(id)} />;

      // ToDo: check if it can be <select> in some cases
    case 'selection':
      return <Select allowClear mode={type.data.maxOptions > 1 ? 'multiple' : undefined} onChange={forceUpdate}>
        {type.data.options.map(({ id, displayName }: Option) =>
          <Select.Option value={id} key={id}>{displayName}</Select.Option>
        )}
      </Select>;

    case 'array/string':
      return <EditableList />;

    case 'json':
      return <CodeEditor handleChange={handleJsonChange(id)} initialValue={form.getFieldValue(id)}/>;

    case 'boolean':
      return <Switch onChange={handleChangeSwitch(id)} checked={get(fieldsValue, id)}/>

    case 'string':
    default:
      return <Input
        autoComplete="off"
        suffix={
          id === '_formData.tableName' ?
            <CaretRightOutlined onClick={() => switchTableNameModal(true)}/> :
            undefined
        }
      />;
    }
  }, [handleJsonChange, form, handleChangeSwitch, handleChangeIntInput, forceUpdate]);

  const getInitialValue = useCallback((id: string, defaultValue: any, constantValue: any, type: string) => {
    const initial = get(initialValues, id);

    if (initial) {
      return initial;
    }

    const calcValue = typeof defaultValue !== 'undefined'
      ? defaultValue
      : typeof constantValue !== 'undefined'
        ? constantValue
        : type === 'json'
          ? {}
          : '';

    return type === 'json'
      ? Object.keys(calcValue).length > 0
        ? JSON.stringify(calcValue)
        : ''
      : calcValue;
  }, [initialValues]);

  const handleDebuggerRun = async(values: any) => {
    const data = {
      expression: '{{if .metric_type }}{{ .metric_type }}{{else}}{{ .app }}_web_prod{{end}}',
      object: {
        _timestamp: '2021-05-21T11:19:59.677503Z',
        api_key: 'ttttd50c-d8f2-414c-bf3d-9902a5031fd2',
        eventn_ctx_event_id: 'f95e340a-8fa8-4e97-b4bf-7f2f1bacc5d6',
        instance_info: {
          built_at: '2021-01-29T16:37:07.000000Z',
          commit: '3427c9f',
          id: 'f9959bbcc353a88eccc84370e2e64997',
          tag: 'v1.27.0'
        },
        metric_type: 'usage',
        source_ip: '81.171.21.86',
        src: 'api',
        timestamp: '2021-05-21T11:19:59.128043Z',
        usage: {
          events: 329
        }
      }
    };

    try {
      const query = new URLSearchParams();
      query.set('project_id', services.activeProject.id);
      query.set('reformat', 'false');

      const result = await services.backendApiClient.post(`/templates/evaluate?${query.toString()}`, data, { proxy: true });

      console.log('result: ', result);
    } catch (error) {
      console.log('error: ', error);
    }
  };

  return (
    <>
      <Modal
        destroyOnClose
        visible={tableNameModal}
        width="80%"
        onCancel={() => switchTableNameModal(false)}
        className={styles.modal}
        wrapClassName={styles.modalWrap}
      >
        <CodeDebugger run={handleDebuggerRun} className="py-5" codeFieldLabel="Expression" />
      </Modal>

      {
        fieldsParamsList.map((param: Parameter) => {
          const { id, documentation, displayName, type, defaultValue, required, constant } = param;

          const constantValue = typeof constant === 'function'
            ?
            constant?.(makeObjectFromFieldsValues(form.getFieldsValue() ?? {}))
            :
            constant;
          const isHidden = constantValue !== undefined;

          return (
            <Row key={id} className={cn(isHidden && 'hidden')}>
              <Col span={24}>
                <Form.Item
                  className={cn('form-field_fixed-label', styles.field)}
                  initialValue={getInitialValue(id, defaultValue, constantValue, type?.typeName)}
                  name={id}
                  hidden={isHidden}
                  label={
                    documentation ?
                      <LabelWithTooltip documentation={documentation} render={displayName} /> :
                      <span>{displayName}:</span>
                  }
                  labelCol={{ span: 4 }}
                  wrapperCol={{ span: 20 }}
                  rules={
                    !isHidden
                      ? type?.typeName === 'isoUtcDate'
                        ? [isoDateValidator(`${displayName} field is required.`)]
                        : [{ required, message: `${displayName} field is required.` }]
                      : undefined
                  }
                >
                  {getFieldComponent(type, id)}
                </Form.Item>
              </Col>
            </Row>
          );
        })
      }
    </>
  );
};

ConfigurableFieldsForm.displayName = 'ConfigurableFieldsForm';

export { ConfigurableFieldsForm };
